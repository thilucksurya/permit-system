package com.logistics.permit_system.model;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Table(name = "declarations") // This connects directly to your Supabase table
@Data // Lombok automatically writes your Getters and Setters hidden in the background
public class Declaration {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // The Senior Dev Touch: Ensures we never have duplicate permit numbers
    @Column(unique = true)
    private String jobNo;

    private String partyName;
    private String portName;
    private String eventDate;
    private String status;
    private String cargoType;
    private String transportMode;
    private String license;
    private Integer outerPack;
    private Double grossWeight;
    private String remarks;

    // This catches all your table items (HS Code, Qty, etc.) as one big JSON string
    @Column(columnDefinition = "TEXT")
    private String itemDetails;
}