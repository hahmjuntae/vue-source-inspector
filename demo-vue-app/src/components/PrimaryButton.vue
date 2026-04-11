<template>
  <button class="primary-button" type="button">
    {{ label }}
  </button>
</template>

<script setup>
defineProps({
  label: {
    type: String,
    default: "Create"
  }
});
</script>

<style scoped>
.primary-button {
  appearance: none;
  -webkit-appearance: none;
  border: 0;
  border-radius: 999px;
  padding: 12px 18px;
  background: linear-gradient(135deg, #1366e3, #0d57c7);
  color: #ffffff;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 14px 30px rgba(19, 102, 227, 0.24);
}
</style>
