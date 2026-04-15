<script setup>
import { computed, onMounted, ref } from 'vue';
import { fetchLinks } from '../api.js';

const links = ref([]);
const err = ref('');
const loading = ref(true);
const page = ref(1);
const pageSize = 10;
const totalPages = ref(1);

const canPrev = computed(() => page.value > 1);
const canNext = computed(() => page.value < totalPages.value);

async function load() {
  err.value = '';
  loading.value = true;
  try {
    const res = await fetchLinks({ page: page.value, pageSize });
    links.value = res.items ?? [];
    totalPages.value = res.totalPages ?? 1;
  } catch (e) {
    err.value = e.message || 'Could not load links';
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  await load();
});
</script>

<template>
  <div>
    <h1 style="margin-top: 0">Tool links</h1>
    <p v-if="loading" class="muted">Loading…</p>
    <p v-if="err" class="error">{{ err }}</p>
    <div v-if="!loading && !links.length && !err" class="muted">No links yet. Add some in Admin.</div>

    <div v-if="!loading && !err" style="display: flex; align-items: center; gap: 0.5rem; margin: 0.75rem 0">
      <button class="btn" :disabled="!canPrev" @click="page--; load()">Prev</button>
      <span class="muted">Page {{ page }} / {{ totalPages }}</span>
      <button class="btn" :disabled="!canNext" @click="page++; load()">Next</button>
    </div>

    <ul class="link-list">
      <li v-for="l in links" :key="l.id" class="link-list-item">
        <a
          :href="l.url"
          target="_blank"
          rel="noopener noreferrer"
          class="link-row card"
        >
          <span class="link-row-icon" aria-hidden="true">{{ l.icon || '🔗' }}</span>
          <span class="link-row-body">
            <span class="link-row-title">{{ l.title }}</span>
            <span v-if="l.description" class="link-row-desc">{{ l.description }}</span>
            <span class="link-row-url muted">{{ l.url }}</span>
          </span>
        </a>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.link-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.link-list-item {
  margin: 0;
}

.link-row {
  display: flex;
  align-items: flex-start;
  gap: 0.85rem;
  text-decoration: none;
  color: inherit;
  width: 100%;
  box-sizing: border-box;
}

.link-row:hover {
  border-color: var(--accent);
}

.link-row-icon {
  font-size: 1.5rem;
  line-height: 1.2;
  flex-shrink: 0;
}

.link-row-body {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
  flex: 1;
}

.link-row-title {
  font-weight: 700;
  font-size: 1rem;
}

.link-row-desc {
  font-size: 0.9rem;
  color: var(--muted);
}

.link-row-url {
  font-size: 0.8rem;
  word-break: break-all;
}
</style>
