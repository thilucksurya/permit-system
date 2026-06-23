var __DEBUG = typeof __DEBUG !== 'undefined' ? __DEBUG : false;
const STORAGE_BUCKET = 'declaration-documents';

const Declarations = {

    async _generateJobNumber() {
        const now = new Date();
        const prefix = now.getFullYear().toString() +
            String(now.getMonth() + 1).padStart(2, '0') +
            String(now.getDate()).padStart(2, '0');
        const time = String(now.getHours()).padStart(2, '0') +
            String(now.getMinutes()).padStart(2, '0') +
            String(now.getSeconds()).padStart(2, '0');
        const rand = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
        return prefix + time + rand;
    },

    async create(data) {
        const client = _getClient();
        const uid = Auth.uid;
        if (!uid) throw new Error('Your session has expired. Please sign in again.');

        let attempts = 0;
        while (attempts < 5) {
            const jobNumber = await this._generateJobNumber();
            const { data: declaration, error } = await client
                .from('declarations')
                .insert([{
                    user_id: uid,
                    job_number: jobNumber,
                    consignee_name: data.consignee_name,
                    consignor_name: data.consignor_name,
                    transport_mode: data.transport_mode || 'road',
                    origin: data.origin,
                    destination: data.destination,
                    outer_package_count: parseFloat(data.outer_package_count) || 0,
                    outer_package_uom: data.outer_package_uom || 'package',
                    gross_weight: parseFloat(data.gross_weight) || 0,
                    weight_uom: data.weight_uom || 'kg',
                    remarks: data.remarks || '',
                    status: 'booking'
                }])
                .select()
                .single();
            if (!error) return declaration;
            if (error.message && (error.message.includes('unique') || error.message.includes('duplicate'))) {
                attempts++;
                continue;
            }
            throw new Error(error.message || 'Failed to create declaration.');
        }
        throw new Error('Failed to create declaration. Please try again.');
    },

    async update(id, data) {
        const client = _getClient();
        const updateData = {};
        const fields = [
            'consignee_name', 'consignor_name', 'transport_mode',
            'origin', 'destination', 'status', 'ccp_file_path',
            'remarks'
        ];
        fields.forEach(f => { if (data[f] !== undefined) updateData[f] = data[f]; });

        if (data.outer_package_count !== undefined) updateData.outer_package_count = parseFloat(data.outer_package_count) || 0;
        if (data.gross_weight !== undefined) updateData.gross_weight = parseFloat(data.gross_weight) || 0;
        if (data.outer_package_uom !== undefined) updateData.outer_package_uom = data.outer_package_uom;
        if (data.weight_uom !== undefined) updateData.weight_uom = data.weight_uom;

        if (updateData.status === 'completed') {
            updateData.completed_at = new Date().toISOString();
        }
        const { data: declaration, error } = await client
            .from('declarations')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();
        if (error) throw new Error(error.message || 'Failed to update declaration.');
        return declaration;
    },

    async delete(id) {
        const client = _getClient();
        const { data: decl } = await client.from('declarations').select('job_number, ccp_file_path').eq('id', id).single();
        if (!decl) throw new Error('Declaration not found.');

        const { data: docs } = await client.from('documents').select('file_path').eq('job_number', decl.job_number);
        if (docs && docs.length) {
            await client.storage.from(STORAGE_BUCKET).remove(docs.map(d => d.file_path));
        }
        await client.from('documents').delete().eq('job_number', decl.job_number);

        await client.from('declaration_items').delete().eq('job_number', decl.job_number);

        if (decl.ccp_file_path) {
            await client.storage.from(STORAGE_BUCKET).remove([decl.ccp_file_path]).catch(() => {});
        }

        const { error } = await client.from('declarations').delete().eq('id', id);
        if (error) throw new Error(error.message || 'Failed to delete declaration.');
    },

    async getById(id) {
        const client = _getClient();
        const { data, error } = await client.from('declarations').select('*').eq('id', id).single();
        if (error) throw new Error('Declaration not found.');
        return data;
    },

    async getAll(filters = {}) {
        const client = _getClient();
        let query = client.from('declarations').select('*');

        if (filters.status && filters.status !== 'all') {
            query = query.eq('status', filters.status);
        }
        if (filters.jobNumber) {
            query = query.ilike('job_number', `%${filters.jobNumber}%`);
        }
        if (filters.consignee) {
            query = query.ilike('consignee_name', `%${filters.consignee}%`);
        }
        if (filters.dateFrom) {
            query = query.gte('created_at', filters.dateFrom);
        }
        if (filters.dateTo) {
            const d = new Date(filters.dateTo);
            d.setDate(d.getDate() + 1);
            query = query.lt('created_at', d.toISOString());
        }

        query = query.order('created_at', { ascending: false });
        const { data, error } = await query;
        if (error) throw new Error(error.message || 'Failed to load declarations.');
        return { declarations: data || [], total: (data || []).length };
    },

    async getStats() {
        const client = _getClient();
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [total, todayCount, bookingCount, completedCount] = await Promise.all([
            client.from('declarations').select('*', { count: 'exact', head: true }),
            client.from('declarations').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
            client.from('declarations').select('*', { count: 'exact', head: true }).eq('status', 'booking'),
            client.from('declarations').select('*', { count: 'exact', head: true }).eq('status', 'completed')
        ]);

        return {
            total: total.count || 0,
            today: todayCount.count || 0,
            booking: bookingCount.count || 0,
            completed: completedCount.count || 0
        };
    },

    async saveItems(jobNumber, items) {
        const client = _getClient();
        await client.from('declaration_items').delete().eq('job_number', jobNumber);
        if (!items || !items.length) return [];

        const rows = items.map((item, idx) => ({
            job_number: jobNumber,
            line_no: idx + 1,
            hs_code: item.hs_code,
            country_of_origin: item.country_of_origin || '',
            goods_description: item.goods_description,
            quantity: parseFloat(item.quantity) || 0,
            amount: parseFloat(item.amount) || 0,
            currency: item.currency || 'USD',
            remarks: item.remarks || ''
        }));

        const { data, error } = await client.from('declaration_items').insert(rows).select();
        if (error) throw new Error(error.message || 'Failed to save items.');
        return data || [];
    },

    async getItems(jobNumber) {
        const client = _getClient();
        const { data, error } = await client
            .from('declaration_items')
            .select('*')
            .eq('job_number', jobNumber)
            .order('line_no', { ascending: true });
        if (error) return [];
        return data || [];
    },

    async uploadDocument(jobNumber, file) {
        const client = _getClient();
        const uid = Auth.uid;
        if (!uid) throw new Error('Session expired.');
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${uid}/${jobNumber}/${Date.now()}_${safeName}`;

        const { error: uploadError } = await client.storage
            .from(STORAGE_BUCKET)
            .upload(path, file, { cacheControl: '3600', upsert: false });
        if (uploadError) throw new Error('Failed to upload file.');

        const { data, error } = await client
            .from('documents')
            .insert([{
                job_number: jobNumber,
                file_name: file.name,
                file_path: path,
                file_size: file.size,
                file_type: file.type,
                uploaded_by: uid
            }])
            .select()
            .single();

        if (error) {
            await client.storage.from(STORAGE_BUCKET).remove([path]);
            throw new Error(error.message || 'Failed to save document record.');
        }
        return data;
    },

    async getDocuments(jobNumber) {
        const client = _getClient();
        const { data, error } = await client
            .from('documents')
            .select('*')
            .eq('job_number', jobNumber)
            .order('uploaded_at', { ascending: false });
        if (error) return [];
        return data || [];
    },

    async deleteDocument(docId, filePath) {
        const client = _getClient();
        await client.storage.from(STORAGE_BUCKET).remove([filePath]).catch(() => {});
        const { error } = await client.from('documents').delete().eq('id', docId);
        if (error) throw new Error('Failed to delete document.');
    },

    async getDownloadUrl(filePath) {
        const client = _getClient();
        const { data, error } = await client.storage.from(STORAGE_BUCKET).createSignedUrl(filePath, 3600);
        if (error) throw new Error('Failed to get download link.');
        return data.signedUrl;
    },

    async downloadFile(filePath, fileName) {
        const url = await this.getDownloadUrl(filePath);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    },

    async saveCCP(declarationId, jobNumber, htmlContent) {
        const client = _getClient();
        const uid = Auth.uid;
        const path = `${uid}/${jobNumber}/CCP_${jobNumber}.html`;
        await client.storage.from(STORAGE_BUCKET).remove([path]).catch(() => {});
        const blob = new Blob([htmlContent], { type: 'text/html' });
        await client.storage.from(STORAGE_BUCKET).upload(path, blob, { cacheControl: '3600', upsert: true }).catch(() => {});
        await client.from('declarations').update({ ccp_file_path: path }).eq('id', declarationId);
        return path;
    }
};
