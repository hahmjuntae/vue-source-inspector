<template>
  <section class="search-layout">
    <header class="search-layout__header">
      <slot name="title" />
    </header>
    <div class="search-layout__body">
      <slot name="search" />
    </div>
  </section>
</template>

<style scoped>
.search-layout {
  border-radius: 28px;
  padding: 24px;
  background: rgba(255, 255, 255, 0.9);
  box-shadow:
    0 0 0 1px rgba(16, 24, 40, 0.06),
    0 20px 60px rgba(15, 23, 42, 0.08);
  backdrop-filter: blur(18px);
}

.search-layout__header {
  margin-bottom: 22px;
}

.search-layout__body {
  display: grid;
  gap: 12px;
}
</style>
