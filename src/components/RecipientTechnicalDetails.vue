<template>
  <section v-if="account" class="modal-card-body">
    <div class="info">
      <div class="info-row">
        <span class="label">{{ $gettext("Backend:") }}</span
        ><span class="value">Comchain</span>
      </div>
      <div class="info-row">
        <span class="label">{{ $gettext("Administrative backend id:") }}</span
        ><span class="value">{{ account?.administrativeBackendId }}</span>
      </div>
      <div class="info-row">
        <span class="label">{{ $gettext("Wallet URI:") }}</span
        ><span class="value">{{ account.id }}</span>
      </div>
    </div>
    <div class="info-row">
      <span class="label">{{ $gettext("Wallet QR Code:") }}</span>
    </div>
    <div class="qrcode-container" ref="qrCode">
      <QrCodeVue
        render-as="svg"
        :value="
          JSON.stringify({
            rp: account.administrativeBackendId,
            rpb: account.id,
          })
        "
      />
    </div>
  </section>
</template>

<script lang="ts">
  import { Options, Vue } from "vue-class-component"
  import QrCodeVue from "qrcode.vue"

  @Options({
    name: "RecipientTechnicalDetails",
    components: {
      QrCodeVue,
    },
    data(this: any) {
      return {
        account: null,
      }
    },
    props: {
      recipient: Object,
    },
    created() {
      this.getAccount()
    },
    methods: {
      async getAccount() {
        this.account = await this.$lokapi.getAccountfromRecipient(
          this.recipient
        )
      },
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

  .qrcode-container {
    width: 100%;

    :deep(svg) {
      width: 100%;
      height: auto;
    }
  }
</style>
