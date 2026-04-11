<template>
  <label class="form-row">
    <span class="form-row__label">{{ label }}</span>
    <span class="form-row__control">
      <slot />
    </span>
  </label>
</template>

<script setup>
defineProps({
  label: {
    type: String,
    required: true
  }
});
</script>

<style scoped>
.form-row {
  display: grid;
  gap: 10px;
}

.form-row__label {
  color: #344054;
  font-size: 13px;
  font-weight: 600;
}

.form-row__control {
  display: block;
}
</style>
