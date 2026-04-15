<script setup>
import { computed, onMounted, ref } from 'vue';
import { authFetch, fetchLinks, getToken, login, setToken } from '../api.js';

const token = ref(getToken());
const username = ref('admin');
const password = ref('');
const loginErr = ref('');
const links = ref([]);
const loadErr = ref('');
const formErr = ref('');
const busy = ref(false);

const editingId = ref(null);
const form = ref({
  title: '',
  url: '',
  icon: '',
  description: '',
  sortOrder: 0,
});

const loggedIn = computed(() => !!token.value);

async function doLogin() {
  loginErr.value = '';
  busy.value = true;
  try {
    const { access_token } = await login(username.value, password.value);
    setToken(access_token);
    token.value = access_token;
    await loadLinks();
  } catch (e) {
    const msg = e?.message || String(e);
    loginErr.value =
      /invalid credential|unauthorized|401/i.test(msg)
        ? 'Invalid username or password'
        : msg;
  } finally {
    busy.value = false;
  }
}

function logout() {
  setToken(null);
  token.value = null;
  links.value = [];
}

async function loadLinks() {
  loadErr.value = '';
  try {
    const res = await fetchLinks({ page: 1, pageSize: 200 });
    links.value = res.items ?? [];
  } catch (e) {
    loadErr.value = e.message;
  }
}

onMounted(() => {
  if (loggedIn.value) loadLinks();
});

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function startCreate() {
  editingId.value = 'new';
  form.value = {
    title: '',
    url: 'https://',
    icon: '',
    description: '',
    sortOrder: links.value.length,
  };
  scrollToTop();
}

function startEdit(l) {
  editingId.value = l.id;
  form.value = {
    title: l.title,
    url: l.url,
    icon: l.icon ?? '',
    description: l.description ?? '',
    sortOrder: l.sortOrder ?? 0,
  };
  scrollToTop();
}

function cancelEdit() {
  editingId.value = null;
}

async function save() {
  loadErr.value = '';
  formErr.value = '';
  busy.value = true;
  try {
    if (!form.value.title?.trim()) {
      formErr.value = 'Title is required.';
      return;
    }
    if (!form.value.url?.trim()) {
      formErr.value = 'URL is required.';
      return;
    }
    if (!/^https?:\/\//i.test(form.value.url.trim())) {
      formErr.value = 'Please enter a valid URL (including https://).';
      return;
    }
    if (editingId.value === 'new') {
      const body = JSON.stringify({
        title: form.value.title,
        url: form.value.url,
        icon: form.value.icon || undefined,
        description: form.value.description || undefined,
        sortOrder: Number(form.value.sortOrder) || 0,
      });
      await authFetch('/api/links', { method: 'POST', body });
    } else {
      const body = JSON.stringify({
        title: form.value.title,
        url: form.value.url,
        icon: form.value.icon || undefined,
        description: form.value.description || undefined,
        sortOrder: Number(form.value.sortOrder) || 0,
      });
      await authFetch(`/api/links/${editingId.value}`, {
        method: 'PATCH',
        body,
      });
    }
    editingId.value = null;
    await loadLinks();
  } catch (e) {
    loadErr.value = e.message;
  } finally {
    busy.value = false;
  }
}

async function remove(id) {
  if (!confirm('Delete this link?')) return;
  loadErr.value = '';
  busy.value = true;
  try {
    await authFetch(`/api/links/${id}`, { method: 'DELETE' });
    await loadLinks();
  } catch (e) {
    loadErr.value = e.message;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div>
    <h1 style="margin-top: 0">Admin</h1>

    <template v-if="!loggedIn">
      <p class="muted">Sign in to create, update, or delete links.</p>
      <div style="max-width: 320px">
        <div class="field">
          <label>Username</label>
          <input v-model="username" autocomplete="username" />
        </div>
        <div class="field">
          <label>Password</label>
          <input v-model="password" type="password" autocomplete="current-password" />
        </div>
        <p v-if="loginErr" class="error">{{ loginErr }}</p>
        <button class="btn btn-primary" :disabled="busy" @click="doLogin">Sign in</button>
      </div>
    </template>

    <template v-else>
      <p class="muted">
        Signed in as {{ username }}.
        <button type="button" class="btn" style="margin-left: 0.5rem" @click="logout">Sign out</button>
      </p>
      <p v-if="loadErr" class="error">{{ loadErr }}</p>
      <p>
        <button class="btn btn-primary" :disabled="busy" @click="startCreate">New link</button>
      </p>

      <div
        v-if="editingId"
        style="
          margin: 1rem 0;
          padding: 1rem;
          border: 1px solid var(--border);
          border-radius: 10px;
          background: var(--surface);
          max-width: 480px;
        "
      >
        <h3 style="margin-top: 0">{{ editingId === 'new' ? 'Create' : 'Edit' }} link</h3>
        <p v-if="formErr" class="error">{{ formErr }}</p>
        <div class="field">
          <label>Title</label>
          <input v-model="form.title" />
        </div>
        <div class="field">
          <label>URL</label>
          <input v-model="form.url" type="url" />
        </div>
        <div class="field">
          <label>Icon (emoji or short text)</label>
          <input v-model="form.icon" placeholder="e.g. 📊" />
        </div>
        <div class="field">
          <label>Description</label>
          <textarea v-model="form.description" rows="2" />
        </div>
        <div class="field">
          <label>Sort order</label>
          <input v-model.number="form.sortOrder" type="number" min="0" />
        </div>
        <button class="btn btn-primary" :disabled="busy" @click="save">Save</button>
        <button type="button" class="btn" :disabled="busy" @click="cancelEdit">Cancel</button>
      </div>

      <ul style="list-style: none; padding: 0; margin: 0">
        <li
          v-for="l in links"
          :key="l.id"
          style="
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 1rem;
            padding: 0.65rem 0;
            border-bottom: 1px solid var(--border);
          "
        >
          <span
            >{{ l.icon || '🔗' }} <strong>{{ l.title }}</strong>
            <span class="muted" style="font-size: 0.85rem"> — {{ l.url }}</span></span
          >
          <span style="flex-shrink: 0">
            <button type="button" class="btn" :disabled="busy" @click="startEdit(l)">Edit</button>
            <button type="button" class="btn btn-danger" :disabled="busy" @click="remove(l.id)">
              Delete
            </button>
          </span>
        </li>
      </ul>
    </template>
  </div>
</template>
