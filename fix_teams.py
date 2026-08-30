with open('frontend/src/pages/Teams.jsx', 'r', encoding='utf-8') as f:
    code = f.read()

code = code.replace("logo: ''", "logo_url: ''")
code = code.replace("logo: team.logo", "logo_url: team.logo_url")
code = code.replace("formData.logo", "formData.logo_url")

with open('frontend/src/pages/Teams.jsx', 'w', encoding='utf-8') as f:
    f.write(code)
