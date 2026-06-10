-- Extensões necessárias para o CrewOmni na base padrão (crewomni_dev)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- Criar base de testes e habilitar extensões
CREATE DATABASE crewomni_test;
\c crewomni_test
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;
