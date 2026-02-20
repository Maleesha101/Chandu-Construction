-- Sample Sites
INSERT INTO sites (name, location, active) VALUES 
('Colombo Site', 'Colombo, Sri Lanka', true),
('Kandy Project', 'Kandy, Sri Lanka', true),
('Galle Construction', 'Galle, Sri Lanka', true);

-- Sample Bank Accounts
INSERT INTO bank_accounts (name, account_number, bank_name, balance, currency, active) VALUES 
('Company Main Account', '123456789', 'Bank of Ceylon', 5000000.00, 'LKR', true),
('Petty Cash Account', '987654321', 'Commercial Bank', 500000.00, 'LKR', true),
('Project Account', '456789123', 'Sampath Bank', 2000000.00, 'LKR', true);

-- Sample Supervisors
INSERT INTO managing_directors (name, contact, email, float_balance, active) VALUES 
('John Silva', '+94771234567', 'john@company.lk', 100000.00, true),
('Maria Perera', '+94777654321', 'maria@company.lk', 150000.00, true),
('Rajesh Kumar', '+94765432109', 'rajesh@company.lk', 200000.00, true);

SELECT 'Sample data inserted successfully!' as message;
