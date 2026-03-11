package com.logistics.permit_system.controller;

import com.logistics.permit_system.model.Declaration;
import com.logistics.permit_system.repository.DeclarationRepository;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/declarations")
@CrossOrigin(origins = "*")
public class DeclarationController {

    private final DeclarationRepository repository;

    // Constructor Injection (preferred over @Autowired field injection)
    public DeclarationController(DeclarationRepository repository) {
        this.repository = repository;
    }

    // 1. Get all declarations (Dashboard table)
    @GetMapping
    public List<Declaration> getAllDeclarations() {
        return repository.findAll();
    }

    // 2. Get a single declaration by Job No
    @GetMapping("/{jobNo}")
    public ResponseEntity<Declaration> getByJobNo(@PathVariable String jobNo) {

        Optional<Declaration> declaration = repository.findByJobNo(jobNo);

        return declaration
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // 3. Create or update declaration
    @PostMapping
    public ResponseEntity<Declaration> createDeclaration(@RequestBody Declaration declaration) {

        Declaration savedDeclaration = repository.save(declaration);

        return ResponseEntity.ok(savedDeclaration);
    }

    // 4. Get last job number for sequence generation
    @GetMapping("/last")
    public ResponseEntity<Declaration> getLastDeclarationByDate(@RequestParam String date) {

        Optional<Declaration> last =
                repository.findFirstByJobNoStartingWithOrderByJobNoDesc(date);

        return last
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.noContent().build());
    }

}

