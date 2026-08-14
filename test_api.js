fetch('http://localhost:8000/api/index.php?route=settings&action=get', {
  headers: {
    'Accept': 'application/json',
    'Cookie': 'PHPSESSID=' // Wait, I don't have the auth cookie...
  }
}).then(r => r.json()).then(console.log);
