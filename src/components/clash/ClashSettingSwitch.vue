<script setup lang="ts">
import '@material/web/switch/switch.js'

const props = defineProps<{ label: string; description?: string; selected: boolean; disabled?: boolean }>()
const emit = defineEmits<{ change: [selected: boolean] }>()

function change(event: Event) {
  const control = event.currentTarget as HTMLElement & { selected: boolean }
  const selected = control.selected
  control.selected = props.selected
  if (selected !== props.selected) emit('change', selected)
}
</script>

<template>
  <div class="clash-setting-row">
    <div class="min-w-0">
      <span class="font-semibold">{{ label }}</span>
      <p v-if="description" class="clash-muted mt-1 text-xs">{{ description }}</p>
    </div>
    <md-switch :aria-label="label" :selected="selected" :disabled="disabled" @change="change"></md-switch>
  </div>
</template>
