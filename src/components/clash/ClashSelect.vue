<script setup lang="ts">
import '@material/web/select/outlined-select.js'
import '@material/web/select/select-option.js'

const props = defineProps<{
  label: string
  modelValue: string
  options: ReadonlyArray<{ value: string; label: string }>
  disabled?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

function select(event: Event) {
  const control = event.currentTarget as HTMLElement & { value: string }
  const value = control.value
  // A change is displayed only after the owning component accepts it.
  control.value = props.modelValue
  if (value !== props.modelValue) emit('update:modelValue', value)
}
</script>

<template>
  <md-outlined-select :label="label" :value="modelValue" :disabled="disabled" @change="select">
    <md-select-option v-for="option in options" :key="option.value" :value="option.value" :selected="modelValue === option.value">
      <div slot="headline">{{ option.label }}</div>
    </md-select-option>
  </md-outlined-select>
</template>
