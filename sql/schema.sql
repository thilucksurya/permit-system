-- ============================================
-- TRADEWEB LIVE - Customs Declaration Schema
-- Supabase PostgreSQL
-- ============================================

-- ============================================
-- TABLE 1: PROFILES
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'approver', 'admin')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- TABLE 2: DECLARATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS declarations (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    job_number TEXT UNIQUE NOT NULL,

    consignee_name TEXT NOT NULL DEFAULT '',
    consignor_name TEXT NOT NULL DEFAULT '',
    transport_mode TEXT NOT NULL DEFAULT 'road' CHECK (transport_mode IN ('road', 'sea', 'air')),
    origin TEXT NOT NULL DEFAULT '',
    destination TEXT NOT NULL DEFAULT '',

    outer_package_count NUMERIC DEFAULT 0,
    outer_package_uom TEXT DEFAULT 'package' CHECK (outer_package_uom IN ('package', 'container')),
    gross_weight NUMERIC DEFAULT 0,
    weight_uom TEXT DEFAULT 'kg' CHECK (weight_uom IN ('kg', 'tne')),

    total_items INT DEFAULT 0,
    total_amount NUMERIC DEFAULT 0,

    status TEXT DEFAULT 'booking' CHECK (status IN ('booking', 'completed')),
    completed_at TIMESTAMPTZ,

    remarks TEXT DEFAULT '',

    ccp_file_path TEXT,

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- TABLE 3: DECLARATION ITEMS
-- ============================================
CREATE TABLE IF NOT EXISTS declaration_items (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    job_number TEXT NOT NULL,
    line_no INT NOT NULL,

    hs_code TEXT NOT NULL DEFAULT '',
    country_of_origin TEXT NOT NULL DEFAULT '',
    goods_description TEXT NOT NULL DEFAULT '',
    quantity NUMERIC DEFAULT 0,
    amount NUMERIC DEFAULT 0,
    currency TEXT DEFAULT 'USD' CHECK (length(currency) = 3),
    remarks TEXT DEFAULT '',

    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- TABLE 4: DOCUMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS documents (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    job_number TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT DEFAULT 0,
    file_type TEXT,
    uploaded_by UUID NOT NULL REFERENCES auth.users(id),
    uploaded_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- TABLE 5: AUDIT LOG
-- ============================================
CREATE TABLE IF NOT EXISTS audit_log (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    job_number TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'completed', 'deleted')),
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_declarations_user_id ON declarations(user_id);
CREATE INDEX IF NOT EXISTS idx_declarations_status ON declarations(status);
CREATE INDEX IF NOT EXISTS idx_declarations_created_at ON declarations(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_items_job_number ON declaration_items(job_number);
CREATE INDEX IF NOT EXISTS idx_documents_job_number ON documents(job_number);
CREATE INDEX IF NOT EXISTS idx_audit_log_job_number ON audit_log(job_number);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (NEW.id, COALESCE(NEW.email, ''), COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-generate job number: YYYYMMDD + 4-digit daily sequence
CREATE OR REPLACE FUNCTION generate_job_number()
RETURNS TRIGGER AS $$
DECLARE next_num INT; prefix TEXT;
BEGIN
    prefix := TO_CHAR(now(), 'YYYYMMDD');
    PERFORM pg_advisory_xact_lock(hashtext(prefix));
    SELECT COALESCE(MAX(CAST(SUBSTRING(job_number FROM 9) AS INT)), 0) + 1
    INTO next_num FROM declarations WHERE job_number LIKE prefix || '%';
    NEW.job_number := prefix || LPAD(next_num::TEXT, 4, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_job_number ON declarations;
CREATE TRIGGER set_job_number
    BEFORE INSERT ON declarations
    FOR EACH ROW
    WHEN (NEW.job_number IS NULL OR NEW.job_number = '')
    EXECUTE FUNCTION generate_job_number();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS declarations_updated_at ON declarations;
CREATE TRIGGER declarations_updated_at
    BEFORE UPDATE ON declarations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-update declaration totals from items (linked by job_number)
CREATE OR REPLACE FUNCTION update_declaration_stats()
RETURNS TRIGGER AS $$
DECLARE jn TEXT;
BEGIN
    jn := COALESCE(NEW.job_number, OLD.job_number);
    UPDATE declarations SET
        total_items = (SELECT COUNT(*)::INT FROM declaration_items WHERE job_number = jn),
        total_amount = (SELECT COALESCE(SUM(amount), 0) FROM declaration_items WHERE job_number = jn)
    WHERE job_number = jn;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS items_stats_insert ON declaration_items;
CREATE TRIGGER items_stats_insert AFTER INSERT ON declaration_items
    FOR EACH ROW EXECUTE FUNCTION update_declaration_stats();

DROP TRIGGER IF EXISTS items_stats_update ON declaration_items;
CREATE TRIGGER items_stats_update AFTER UPDATE ON declaration_items
    FOR EACH ROW EXECUTE FUNCTION update_declaration_stats();

DROP TRIGGER IF EXISTS items_stats_delete ON declaration_items;
CREATE TRIGGER items_stats_delete AFTER DELETE ON declaration_items
    FOR EACH ROW EXECUTE FUNCTION update_declaration_stats();

-- Audit log
CREATE OR REPLACE FUNCTION log_declaration_action()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_log (job_number, user_id, action, remarks)
        VALUES (NEW.job_number, NEW.user_id, 'created', 'Declaration created');
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.status IS DISTINCT FROM NEW.status THEN
            INSERT INTO audit_log (job_number, user_id, action, remarks)
            VALUES (NEW.job_number, NEW.user_id,
                CASE NEW.status WHEN 'completed' THEN 'completed' ELSE 'updated' END, NULL);
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_log (job_number, user_id, action, remarks)
        VALUES (OLD.job_number, OLD.user_id, 'deleted', 'Declaration deleted');
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS declarations_audit_log ON declarations;
CREATE TRIGGER declarations_audit_log
    AFTER INSERT OR UPDATE OR DELETE ON declarations
    FOR EACH ROW EXECUTE FUNCTION log_declaration_action();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE declarations ENABLE ROW LEVEL SECURITY;
ALTER TABLE declaration_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "p_profiles_select_own" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "p_profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Declarations: owner can CRUD, admin/approver can read all
CREATE POLICY "p_declarations_select" ON declarations FOR SELECT USING (
    user_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'approver'))
);
CREATE POLICY "p_declarations_insert" ON declarations FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "p_declarations_update" ON declarations FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
CREATE POLICY "p_declarations_update_admin" ON declarations FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'approver'))
);
CREATE POLICY "p_declarations_delete" ON declarations FOR DELETE USING (user_id = auth.uid());

-- Declaration Items: access via job_number match
CREATE POLICY "p_items_select" ON declaration_items FOR SELECT USING (
    EXISTS (SELECT 1 FROM declarations WHERE job_number = declaration_items.job_number AND (user_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'approver'))))
);
CREATE POLICY "p_items_insert" ON declaration_items FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM declarations WHERE job_number = declaration_items.job_number AND user_id = auth.uid() AND status = 'booking')
);
CREATE POLICY "p_items_delete" ON declaration_items FOR DELETE USING (
    EXISTS (SELECT 1 FROM declarations WHERE job_number = declaration_items.job_number AND user_id = auth.uid() AND status = 'booking')
);

-- Documents: access via job_number match
CREATE POLICY "p_documents_select" ON documents FOR SELECT USING (
    EXISTS (SELECT 1 FROM declarations WHERE job_number = documents.job_number AND (user_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'approver'))))
);
CREATE POLICY "p_documents_insert" ON documents FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM declarations WHERE job_number = documents.job_number AND user_id = auth.uid() AND status = 'booking')
);
CREATE POLICY "p_documents_delete" ON documents FOR DELETE USING (
    EXISTS (SELECT 1 FROM declarations WHERE job_number = documents.job_number AND user_id = auth.uid() AND status = 'booking')
);

-- Audit Log
CREATE POLICY "p_audit_log_select" ON audit_log FOR SELECT USING (
    user_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'approver'))
);

-- ============================================
-- STORAGE
-- ============================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('declaration-documents', 'declaration-documents', false, 52428800,
    ARRAY['application/pdf','image/jpeg','image/png','image/jpg',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel','text/html'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS p_storage_insert ON storage.objects;
DROP POLICY IF EXISTS p_storage_select ON storage.objects;
DROP POLICY IF EXISTS p_storage_update ON storage.objects;
DROP POLICY IF EXISTS p_storage_delete ON storage.objects;

CREATE POLICY "p_storage_insert" ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'declaration-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "p_storage_select" ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'declaration-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "p_storage_update" ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'declaration-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "p_storage_delete" ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'declaration-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
