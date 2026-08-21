# Zero-JS Web UI CSS & HTML Design System Reference

This document provides the canonical CSS design system and HTML layout patterns for zero-JavaScript server-rendered Web UIs.

---

## 1. CSS Theme Tokens (`:root`)

```css
:root {
  --bg: #f8fafc;
  --card-bg: #ffffff;
  --text: #0f172a;
  --text-muted: #64748b;
  --primary: #2563eb;
  --primary-hover: #1d4ed8;
  --success: #16a34a;
  --success-bg: #f0fdf4;
  --danger: #dc2626;
  --danger-bg: #fef2f2;
  --border: #e2e8f0;
  --radius: 8px;
}
```

---

## 2. Core Layout & Responsive Grid

```css
* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  background-color: var(--bg);
  color: var(--text);
  line-height: 1.5;
  padding: 2rem 1rem;
}

.container {
  width: 90%;
  max-width: 1800px;
  margin: 0 auto;
}

header {
  margin-bottom: 2rem;
  border-bottom: 2px solid var(--border);
  padding-bottom: 1rem;
}

h1 { font-size: 1.875rem; font-weight: 700; color: var(--text); }
.subtitle { color: var(--text-muted); font-size: 0.95rem; margin-top: 0.25rem; }

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.card {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}

.card h2 {
  font-size: 1.25rem;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--border);
}
```

---

## 3. Forms, Inputs & Buttons

```css
.form-group {
  margin-bottom: 1rem;
}

label {
  display: block;
  font-size: 0.875rem;
  font-weight: 600;
  margin-bottom: 0.35rem;
  color: var(--text);
}

input, select {
  width: 100%;
  padding: 0.6rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 0.95rem;
  color: var(--text);
  background: #ffffff;
}

input:focus, select:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(37,99,235,0.15);
}

button, .btn {
  display: inline-block;
  width: 100%;
  padding: 0.65rem 1rem;
  background: var(--primary);
  color: #ffffff;
  border: none;
  border-radius: 6px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  text-align: center;
  text-decoration: none;
}

button:hover { background: var(--primary-hover); }

.btn-danger {
  background: var(--danger);
  padding: 0.35rem 0.65rem;
  font-size: 0.85rem;
  width: auto;
}
.btn-danger:hover { background: #b91c1c; }
```

---

## 4. Banners, Tables & Badges

```css
/* Flash Notification Banners */
.banner {
  padding: 0.85rem 1.25rem;
  border-radius: var(--radius);
  margin-bottom: 1.5rem;
  font-weight: 500;
}
.banner-success { background: var(--success-bg); color: var(--success); border: 1px solid #bbf7d0; }
.banner-error { background: var(--danger-bg); color: var(--danger); border: 1px solid #fecaca; }

/* Data Tables */
table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 0.5rem;
  font-size: 0.9rem;
}

th, td {
  padding: 0.75rem;
  text-align: left;
  border-bottom: 1px solid var(--border);
}

th {
  background: #f1f5f9;
  font-weight: 600;
  color: var(--text-muted);
}

/* Status Badges */
.badge {
  display: inline-block;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.badge-confirmed { background: #dcfce7; color: #15803d; }
.badge-cancelled { background: #f3f4f6; color: #6b7280; }
.badge-active { background: #dbeafe; color: #1e40af; }
.badge-inactive { background: #fee2e2; color: #991b1b; }

/* Card Results List Items */
.available-list {
  margin-top: 1rem;
  list-style: none;
}
.available-item {
  padding: 0.6rem;
  border: 1px solid #bbf7d0;
  background: #f0fdf4;
  border-radius: 6px;
  margin-bottom: 0.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.9rem;
}
```

---

## 5. HTML Page Skeleton Example

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>App Title (Zero JS)</title>
  <style>
    /* Insert CSS from sections 1-4 above */
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>App Title</h1>
      <p class="subtitle">Subtitle description</p>
    </header>

    <!-- Success / Error Flash Banners -->
    <div class="banner banner-success">Action performed successfully!</div>

    <div class="grid">
      <!-- Search Card -->
      <div class="card">
        <h2>Search</h2>
        <form method="GET" action="/">
          <div class="form-group">
            <label for="query">Search Input</label>
            <input type="text" id="query" name="query" required>
          </div>
          <button type="submit">Search</button>
        </form>
      </div>

      <!-- Form Card -->
      <div class="card">
        <h2>Add Item</h2>
        <form method="POST" action="/ui/items">
          <div class="form-group">
            <label for="name">Item Name</label>
            <input type="text" id="name" name="name" required>
          </div>
          <button type="submit">Save</button>
        </form>
      </div>
    </div>
  </div>
</body>
</html>
```
