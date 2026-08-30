with open('frontend/src/App.jsx', 'r', encoding='utf-8') as f:
    code = f.read()

code = code.replace("} from 'lucide-react';", ", UploadCloud } from 'lucide-react';")

with open('frontend/src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(code)
