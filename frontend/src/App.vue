<script setup>
import { RouterLink, RouterView } from 'vue-router';
</script>

<template>
  <div class="layout">
    <header class="header">
      <RouterLink to="/" class="brand">Developer tools</RouterLink>
      <nav>
        <RouterLink to="/">Links</RouterLink>
        <RouterLink to="/admin">Admin</RouterLink>
      </nav>
    </header>
    <main class="main">
      <RouterView />
    </main>
  </div>
</template>

<style>
:root {
  --bg: #041628;
  --surface: #1a2332;
  --text: #e7ecf3;
  --muted: #8b9cb3;
  --accent: #3d8bfd;
  --border: #214579;
}
* {
  box-sizing: border-box;
}
body {
  margin: 0;
  font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
  background: var(--bg);
  color: var(--text);
  line-height: 1.5;
}
a {
  color: var(--accent);
  text-decoration: none;
}
a:hover {
  text-decoration: underline;
}
.layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1.25rem;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}
.brand {
  font-weight: 700;
  color: var(--text);
}
.header nav {
  display: flex;
  gap: 1rem;
}
.main {
  flex: 1;
  padding: 1.25rem;
  max-width: 960px;
  margin: 0 auto;
  width: 100%;
}
.card-grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
}
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 1rem;
  transition: border-color 0.15s;
}
.card:hover {
  border-color: var(--accent);
}
.card h2 {
  margin: 0 0 0.5rem;
  font-size: 1.05rem;
}
.card .meta {
  font-size: 0.85rem;
  color: var(--muted);
  margin-bottom: 0.75rem;
}
.btn {
  display: inline-block;
  padding: 0.45rem 0.85rem;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
  font-size: 0.9rem;
}
.btn:hover {
  border-color: var(--accent);
}
.btn-primary {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
.btn-danger {
  border-color: #c44;
  color: #f88;
}
input,
textarea {
  width: 100%;
  padding: 0.5rem 0.65rem;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
  font: inherit;
}
label {
  display: block;
  font-size: 0.8rem;
  color: var(--muted);
  margin-bottom: 0.25rem;
}
.field {
  margin-bottom: 0.75rem;
}
.error {
  color: #f88;
  font-size: 0.9rem;
  margin: 0.5rem 0;
}
.muted {
  color: var(--muted);
  font-size: 0.9rem;
}
</style>
