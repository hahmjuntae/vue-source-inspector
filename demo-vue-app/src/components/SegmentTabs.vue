<template>
  <div class="segment-tabs">
    <button
      v-for="option in options"
      :key="option"
      :class="['segment-tabs__button', { 'segment-tabs__button--active': modelValue === option }]"
      type="button"
      @click="$emit('update:modelValue', option)"
    >
      {{ option }}
    </button>
  </div>
</template>

<script setup>
defineProps({
  modelValue: {
    type: String,
    default: ""
  },
  options: {
    type: Array,
    default: () => []
  }
});

defineEmits(["update:modelValue"]);
</script>

<style scoped>
.segment-tabs {
  display: inline-flex;
  gap: 8px;
  padding: 6px;
  border-radius: 18px;
  background: #f2f4f7;
}

.segment-tabs__button {
  appearance: none;
  -webkit-appearance: none;
  border: 0;
  border-radius: 14px;
  padding: 10px 14px;
  background: transparent;
  color: #667085;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.segment-tabs__button--active {
  background: #ffffff;
  color: #101828;
  box-shadow: 0 1px 2px rgba(16, 24, 40, 0.1);
}
</style>
