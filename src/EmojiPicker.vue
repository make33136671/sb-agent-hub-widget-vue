<script setup lang="ts">
import { ref } from 'vue'

interface Props {
  visible: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  select: [emoji: string]
  close: []
}>()

const emojiList = [
  '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂',
  '🙂', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗',
  '😚', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗',
  '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶',
  '😏', '😒', '🙄', '😬', '😮‍💨', '🤥', '😌', '😔',
  '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮',
  '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳',
  '😎', '🤓', '🧐', '😕', '😟', '🙁', '☹️', '😮',
  '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰',
  '😥', '😢', '😭', '😱', '😖', '😣', '😞', '😓',
  '👍', '👎', '👌', '🤌', '🤏', '✌️', '🤞', '🤟',
  '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️', '👋',
  '🤚', '🖐️', '✋', '🖖', '👏', '🙌', '🤝', '🙏',
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍',
  '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘',
  '⭐', '✨', '🌟', '💫', '🔥', '💯', '✅', '❌',
  '❓', '❗', '💤', '💬', '👀', '🎉', '🎊', '🎁',
]

const categories = [
  { name: '常用', start: 0, end: 32 },
  { name: '情绪', start: 32, end: 56 },
  { name: '手势', start: 56, end: 80 },
  { name: '心形', start: 80, end: 96 },
  { name: '其他', start: 96, end: 112 },
]

const activeCategory = ref(0)

const handleSelect = (emoji: string) => {
  emit('select', emoji)
}

const handleClose = () => {
  emit('close')
}

const getCurrentEmojis = () => {
  const cat = categories[activeCategory.value]!
  return emojiList.slice(cat.start, cat.end)
}
</script>

<template>
  <div v-if="visible" class="emoji-picker">
    <div class="emoji-categories">
      <button
        v-for="(cat, index) in categories"
        :key="cat.name"
        class="category-btn"
        :class="{ active: activeCategory === index }"
        @click="activeCategory = index"
      >
        {{ cat.name }}
      </button>
    </div>

    <div class="emoji-grid">
      <button
        v-for="emoji in getCurrentEmojis()"
        :key="emoji"
        class="emoji-btn"
        @click="handleSelect(emoji)"
      >
        {{ emoji }}
      </button>
    </div>

    <button class="close-btn" @click="handleClose">关闭</button>
  </div>
</template>

<style scoped>
.emoji-picker {
  position: absolute;
  bottom: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #e8e8e8;
  border-radius: 12px 12px 0 0;
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.1);
  padding: 12px;
  z-index: 100;
}

.emoji-categories {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  border-bottom: 1px solid #f0f0f0;
  padding-bottom: 8px;
}

.category-btn {
  padding: 4px 12px;
  border: none;
  background: #f5f5f5;
  border-radius: 16px;
  font-size: 12px;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
}

.category-btn:hover {
  background: #e8e8e8;
}

.category-btn.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.emoji-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 4px;
  max-height: 200px;
  overflow-y: auto;
}

.emoji-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  font-size: 22px;
  cursor: pointer;
  border-radius: 8px;
  transition: background 0.2s;
}

.emoji-btn:hover {
  background: #f0f0f0;
}

.close-btn {
  display: none;
}

@media (max-width: 480px) {
  .emoji-grid {
    grid-template-columns: repeat(6, 1fr);
  }
  .emoji-btn {
    width: 44px;
    height: 44px;
    font-size: 24px;
  }
}
</style>
