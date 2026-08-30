-- Add theme color columns to institutions
ALTER TABLE institutions
ADD COLUMN theme_color_1 TEXT DEFAULT '#4f46e5',
ADD COLUMN theme_color_2 TEXT DEFAULT '#312e81';
