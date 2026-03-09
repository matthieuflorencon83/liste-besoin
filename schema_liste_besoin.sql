-- ============================================
-- SQL init for Liste de besoin Database (Enriched)
-- ============================================

CREATE DATABASE IF NOT EXISTS liste_besoin_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE liste_besoin_db;

-- 1. Table: article
CREATE TABLE IF NOT EXISTS article (
    id INT AUTO_INCREMENT PRIMARY KEY,
    reference VARCHAR(100) NOT NULL UNIQUE,
    designation VARCHAR(500) NOT NULL,
    famille VARCHAR(100),
    sous_famille VARCHAR(100),
    type_article VARCHAR(100),
    gamme VARCHAR(100),
    serie VARCHAR(100),
    fabricant VARCHAR(150),
    fournisseur_defaut VARCHAR(100),
    
    -- Dimensions et poids
    poids_kg DECIMAL(10, 3) DEFAULT NULL,
    surface_m2 DECIMAL(10, 3) DEFAULT NULL,
    dimension VARCHAR(100) DEFAULT NULL,
    epaisseur VARCHAR(50) DEFAULT NULL,
    
    -- Unités et commandes
    unite_vente VARCHAR(20) DEFAULT NULL,
    unite_qte VARCHAR(20) DEFAULT NULL,
    unite_condit VARCHAR(20) DEFAULT NULL,
    multiple_cde DECIMAL(10, 2) DEFAULT 1.00,
    tenu_en_stock VARCHAR(20) DEFAULT 'Non',
    
    image_url VARCHAR(512) DEFAULT NULL,
    mots_cles TEXT DEFAULT NULL,
    
    cree_le DATETIME DEFAULT CURRENT_TIMESTAMP,
    modifie_le DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 2. Table: finition
CREATE TABLE IF NOT EXISTS finition (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nom VARCHAR(150) NOT NULL UNIQUE, -- e.g., 'Standard', 'RAL 9016', 'Gris'
    type_finition VARCHAR(100), -- 'Couleur', 'Decor', 'Standard'
    cree_le DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 3. Table: prix (Grille tarifaire / Table de liaison)
CREATE TABLE IF NOT EXISTS prix (
    id INT AUTO_INCREMENT PRIMARY KEY,
    article_id INT NOT NULL,
    finition_id INT NOT NULL,
    
    prix_u_ht DECIMAL(10, 2) DEFAULT NULL,
    ancien_prix_u_ht DECIMAL(10, 2) DEFAULT NULL,
    prix_public DECIMAL(10, 2) DEFAULT NULL,
    px_remise DECIMAL(10, 2) DEFAULT NULL,
    
    conditionnement VARCHAR(100) DEFAULT NULL,
    fournisseur_nom VARCHAR(100), 
    date_prix DATE DEFAULT NULL,
    
    cree_le DATETIME DEFAULT CURRENT_TIMESTAMP,
    modifie_le DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (article_id) REFERENCES article(id) ON DELETE CASCADE,
    FOREIGN KEY (finition_id) REFERENCES finition(id) ON DELETE CASCADE,
    
    UNIQUE KEY (article_id, finition_id, fournisseur_nom)
) ENGINE=InnoDB;

-- Insert default finition
INSERT IGNORE INTO finition (nom, type_finition) VALUES 
('Standard', 'Base');
