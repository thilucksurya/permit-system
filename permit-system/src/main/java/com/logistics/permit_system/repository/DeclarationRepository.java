package com.logistics.permit_system.repository;

import com.logistics.permit_system.model.Declaration;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface DeclarationRepository extends JpaRepository<Declaration, Long> {
    Optional<Declaration> findByJobNo(String jobNo);
    Optional<Declaration> findFirstByJobNoStartingWithOrderByJobNoDesc(String datePrefix);
}