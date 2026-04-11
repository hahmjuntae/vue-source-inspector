<template>
  <input
    :value="modelValue"
    :placeholder="placeholder"
    class="text-field"
    type="text"
    @input="$emit('update:modelValue', $event.target.value)"
  />
</template>

<script setup>
defineProps({
  modelValue: {
    type: String,
    default: ""
  },
  placeholder: {
    type: String,
    default: ""
  }
});

defineEmits(["update:modelValue"]);
</script>

<style scoped>
.text-field {
  width: 100%;
  border: 1px solid rgba(16, 24, 40, 0.1);
  border-radius: 16px;
  padding: 14px 16px;
  background: #f8fafc;
  color: #101828;
  font: inherit;
  outline: none;
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease,
    box-shadow 0.2s ease;
}

.text-field:focus {
  border-color: rgba(23, 104, 223, 0.5);
  background: #ffffff;
  box-shadow: 0 0 0 4px rgba(23, 104, 223, 0.12);
}
</style>
