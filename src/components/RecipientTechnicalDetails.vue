<template>
  <section class="modal-card-body">
    <div class="info">
      <div class="info-row">
        <span class="label">{{ $gettext("Backend:") }}</span
        ><span class="value">Comchain</span>
      </div>
      <div class="info-row">
        <span class="label">{{ $gettext("Administrative backend id:") }}</span
        ><span class="value">{{ administrativeBackendId }}</span>
      </div>
      <div class="info-row">
        <span class="label">{{ $gettext("Wallet URI:") }}</span
        ><span class="value">{{ walletUri }}</span>
      </div>
    </div>
  </section>
</template>

<script lang="ts">
  import { Options, Vue } from "vue-class-component"

  @Options({
    name: "RecipientTechnicalDetails",
    components: {},
    props: {
      administrativeBackendId: String,
      walletUri: String,
    },
  })
  export default class RecipientTechnicalDetails extends Vue {}
</script>

<style lang="scss" scoped>
  @import "@/assets/custom-variables";

  .info {
    min-width: 0;
    white-space: normal;
    overflow-wrap: anywhere;
    word-break: break-word;
  }

  .info-row {
    display: flex;
    align-items: baseline;
    margin-bottom: 0.5rem;
  }

  .value {
    margin-left: 0.25rem;
    flex: 1;
    min-width: 0;
  }

  .label {
    font-weight: bold;
  }
</style>
