CREATE TABLE IF NOT EXISTS instructions (
    id SERIAL PRIMARY KEY,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO instructions (message) VALUES 
('Réalise le docker-compose et branche le front sur le back. Bonne chance !');
