<template>
  <component v-for="modal in $modal.modals.value" :is="modal" />
</template>
<script lang="ts">
  import { Options, Vue } from "vue-class-component"

  import MoneyTransferModal from "./MoneyTransferModal.vue"
  import MoneyCreditModal from "./MoneyCreditModal.vue"
  import AboutModal from "./AboutModal.vue"
  import TransactionListModal from "./TransactionListModal.vue"

  @Options({
    name: "Modal",
    components: {
      MoneyTransferModal,
      MoneyCreditModal,
      AboutModal,
      TransactionListModal,
    },
    data() {
      return {
        callbacks: {},
      }
    },
    created() {
      this.$modal.register({
        show: (label: string) =>
          new Promise((resolve, reject) => {
            if (this.callbacks[label])
              throw new Error(`Modal '${label}' already opened.`)
            this.callbacks[label] = { resolve, reject }
          }),
        hide: (label: string) => {
          this.callbacks[label].resolve()
          delete this.callbacks[label]
        },
      })
    },
  })
  export default class Modal extends Vue {}
</script>
<style lang="scss" scoped>
  .modal-card {
    position: relative;
    top: -5vh;
  }
</style>
