<template>
  <div class="notification is-danger is-light" v-if="hasLoadingError">
    <p class="mb-4">
      {{
        $gettext(
          "An unexpected issue occurred while loading the " +
            "top up request list. Sorry for the inconvenience"
        )
      }}
    </p>
    <p>
      {{
        $gettext(
          "You can try to refresh the page, if the issue " +
            "persists, you may want to contact your " +
            "administrator"
        )
      }}
    </p>
  </div>

  <p
    class="notification is-default"
    v-else-if="topUpsPendingForApproval.length === 0"
  >
    {{ $gettext("No top up request waiting for approval") }}
  </p>
  <div>
    <div class="section-card">
      <h2 class="custom-card-title title-card">
        {{ $gettext("Top up requests waiting for approval") }}
      </h2>

      <TransactionItem
        v-for="transaction in topUpsPendingForApproval"
        :key="transaction"
        :transaction="transaction"
        :account="account"
        @click="
          $modal.open('ConfirmPaymentModal', {
            transaction,
            type: 'topup',
            account,
            refreshTransaction: refreshTransaction,
            refreshAccounts: refreshAccounts,
            onConfirm: () => validateCreditRequest(transaction),
          })
        "
      />
    </div>
  </div>
</template>

<script lang="ts">
  import { mapGetters } from "vuex"
  import { Options, Vue } from "vue-class-component"
  import { UIError } from "@/exception"
  import { showSpinnerMethod, replaceWithLoader } from "@/utils/showSpinner"
  import applyDecorators from "@/utils/applyDecorators"
  import { debounceMethod, debounceMethodWithOpts } from "@/utils/debounce"

  import TransactionItem from "@/components/TransactionItem.vue"

  @Options({
    name: "PendingCredits",
    components: {
      TransactionItem,
    },
    data() {
      return {
        hasLoadingError: false,
        validationRequestOngoing: [],
        topUpsPendingForApproval: [],
      }
    },
    async mounted() {
      await this.updatePendingCreditRequests()
    },
    computed: {
      pendingCreditRequests(): Array<any> {
        return this.$store.state.lokapi.pendingCreditRequests
      },
      ...mapGetters(["numericFormat", "relativeDateFormat", "dateFormat"]),
    },
    methods: {
      validateCreditRequest: applyDecorators(
        [
          debounceMethodWithOpts({
            keyFn: (request: any) => request.jsonData.odoo.credit_id,
          }),
        ],
        async function (this: any, request: any): Promise<void> {
          if (this.validationRequestOngoing.includes(request)) {
            console.log("Debounced `.validateCreditRequest()` call")
            return
          }
          this.validationRequestOngoing.push(request)
          await this.validateRequest(request)
          await this.updatePendingCreditRequests
        }
      ),

      updatePendingCreditRequests: applyDecorators(
        [showSpinnerMethod(".transactions")],
        async function (this: any): Promise<void> {
          let topUpsPendingForApproval = []

          try {
            topUpsPendingForApproval = await this.$lokapi.getCreditRequests()
            this.hasLoadingError = false
          } catch (err: any) {
            console.error("Failed to fetch pending credit requests", err)
            this.hasLoadingError = true
            throw new UIError(
              this.$gettext(
                "An unexpected issue occurred while updating the pending accounts list"
              ),
              err
            )
          }
          this.topUpsPendingForApproval = topUpsPendingForApproval.map(
            (e: any) => {
              e.fromTopUpsPendingForApproval = true
              return e
            }
          )
        }
      ),
      refreshTransaction() {
        this.updatePendingCreditRequests()
      },
      refreshAccounts() {
        // No account refresh needed here, but provided for modal compatibility
      },
    },
  })
  export default class Admin extends Vue {}
</script>
<style scoped lang="sass"></style>
