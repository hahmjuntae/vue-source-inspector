<template>
  <article class="result-card">
    <p class="result-card__title">{{ title }}</p>
    <p class="result-card__value">{{ value }}</p>
    <p class="result-card__description">{{ description }}</p>
  </article>
</template>

<script setup>
defineProps({
  title: {
    type: String,
    required: true
  },
  value: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  }
});
</script>

<style scoped>
.result-card {
  border-radius: 22px;
  padding: 22px;
  background: rgba(255, 255, 255, 0.88);
  box-shadow:
    0 0 0 1px rgba(16, 24, 40, 0.05),
    0 16px 40px rgba(15, 23, 42, 0.08);
}

.result-card__title {
  margin: 0 0 12px;
  color: #667085;
  font-size: 13px;
  font-weight: 600;
}

.result-card__value {
  margin: 0;
  font-size: 34px;
  font-weight: 700;
  letter-spacing: -0.05em;
}

.result-card__description {
  margin: 12px 0 0;
  color: #475467;
  font-size: 14px;
  line-height: 1.6;
}
</style>
