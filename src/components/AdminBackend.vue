<template>
  <div class="container">
    <div class="item mb-2">
      <div class="title-card">
        {{ $gettext("General user account info") }}
      </div>
      <div class="recipient-actions-row">
        <div class="recipient-item">
          <RecipientItem
            :recipient="recipient"
            :hideAdminButton="true"
            :toggleRefreshBadge="toggleRefreshBadge"
          />
        </div>
        <div class="recipient-dropdown">
          <DropdownMenu :object="recipient" />
        </div>
      </div>
    </div>
    <div class="item mb-4">
      <div class="title-card">
        {{ $gettext("User account") }}
      </div>
      <div
        class="bank-account-item"
        :class="{
          active: userAccount.active,
        }"
      >
        <BankAccountItem
          :account="userAccount"
          :showSubAccounts="true"
          :disableDropDown="false"
          :isAccountSelected="true"
          :toggleRefreshBadge="toggleRefreshBadge"
        >
          <template v-slot:name>{{
            userAccount.name ? userAccount.name() : $gettext("Unavailable")
          }}</template>
        </BankAccountItem>
      </div>
    </div>

    <div class="item mb-2">
      <div class="title-card">
        {{ $gettext("Account actions") }}
      </div>
      <div class="section-card mt-2">
        <form @submit.prevent="onSaveAccountChanges">
          <div class="field account-action-row">
            <label class="account-action-label">{{
              $gettext("Account type:")
            }}</label>
            <div class="control account-action-control">
              <DropdownButton
                :options="[
                  { value: 'professional', label: $gettext('Professional') },
                  { value: 'personal', label: $gettext('Personal') },
                ]"
                customWidth="10em"
                v-model="accountForm.accountType"
              />
            </div>
          </div>
          <div class="field account-action-row">
            <label class="account-action-label">{{
              $gettext("Account status: ")
            }}</label>
            <div class="is-flex is-align-items-center account-action-control">
              <label class="switch mr-2">
                <input type="checkbox" v-model="accountForm.status" />
                <span class="slider round"></span>
              </label>
              <span class="has-text-weight-medium">
                {{
                  accountForm.status
                    ? $gettext("Enabled")
                    : $gettext("Disabled")
                }}
              </span>
            </div>
          </div>
          <div class="field account-action-row account-action-column">
            <label class="account-action-label barter-label">{{
              $gettext("Mutual credit balance limits:")
            }}</label>
            <div class="currency-limit-fields ml-4">
              <div class="field currency-limit-field">
                <label class="currency-limit-label">
                  {{ $gettext("Maximum allowed") }}
                </label>
                <div class="currency-limit-input">
                  <div class="control">
                    <input
                      class="input"
                      :class="{ 'is-danger': negativeLimitError }"
                      type="number"
                      v-model="accountForm.highLimit"
                    />
                  </div>
                  <div v-if="negativeLimitError" class="help is-danger">
                    {{ negativeLimitError }}
                  </div>
                </div>
              </div>
              <div class="field currency-limit-field">
                <label class="currency-limit-label">
                  {{ $gettext("Minimum allowed") }}
                </label>
                <div class="currency-limit-input">
                  <div class="control">
                    <input
                      class="input"
                      :class="{ 'is-danger': positiveLimitError }"
                      type="number"
                      v-model="accountForm.lowLimit"
                    />
                  </div>
                  <div v-if="positiveLimitError" class="help is-danger">
                    {{ positiveLimitError }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
  import { Options, Vue } from "vue-class-component"
  import BankAccountItem from "./BankAccountItem.vue"
  import RecipientItem from "@/components/RecipientItem.vue"
  import RecipientSelector from "@/components/RecipientSelector.vue"
  import { replaceOrInsertElt } from "@/services/lokapiService"
  import { mapGetters } from "vuex"
  import TransactionList from "./TransactionList.vue"
  import { UIError } from "../exception"
  import DropdownButton from "./DropdownButton.vue"
  import DropdownMenu from "@/components/DropdownMenu.vue"

  import UseBatchLoading from "@/services/UseBatchLoading"
  import applyDecorators from "@/utils/applyDecorators"
  import { showSpinnerMethod } from "@/utils/showSpinner"

  const isFulfilled = <T>(
    p: PromiseSettledResult<T>
  ): p is PromiseFulfilledResult<T> => p.status === "fulfilled"

  @Options({
    name: "AdminBackend",
    data() {
      return {
        userAccount: {},
        recipient: {},
        backend: {},
        option: null,
        accountForm: {},
        initialAccountForm: {},
      }
    },
    components: {
      BankAccountItem,
      RecipientItem,
      RecipientSelector,
      TransactionList,
      DropdownButton,
      DropdownMenu,
    },
    emits: ["account-form-change"],
    props: {
      toggleRefreshBadge: Boolean,
      selectedRecipient: Object,
    },
    async created() {
      this.accountForm.accountType = "professional"
    },
    async mounted() {
      await this.getRecipient()
      await this.refreshAccounts()

      await this.initializeAccountForm()
    },
    computed: {
      ...mapGetters(["activeVirtualAccounts"]),
      isAccountFormChanged() {
        return (
          this.accountForm.status !== this.initialAccountForm.status ||
          this.accountForm.accountType !==
            this.initialAccountForm.accountType ||
          this.accountForm.highLimit !== this.initialAccountForm.highLimit ||
          this.accountForm.lowLimit !== this.initialAccountForm.lowLimit
        )
      },
      negativeLimitError() {
        const value = this.parseLimitValue(this.accountForm.highLimit)
        if (value === null || value < 0) {
          return this.$gettext("Maximum limit must be zero or greater.")
        } else {
          return false
        }
      },
      positiveLimitError() {
        const value = this.parseLimitValue(this.accountForm.lowLimit)
        if (value === null || value > 0) {
          return this.$gettext("Minimum limit must be zero or less.")
        } else {
          return false
        }
      },
    },
    watch: {
      accountForm: {
        handler() {
          this.emitAccountFormChange()
        },
        deep: true,
      },
      async toggleRefreshBadge() {
        await this.getRecipient()
        await this.refreshAccounts()
        await this.initializeAccountForm()
      },
    },
    methods: {
      onAccountSelected(account: any) {
        this.userAccount = account
      },
      async getRecipient() {
        try {
          this.recipient = await this.getRecipientByUri()
        } catch (err: any) {
          throw new UIError(
            this.$gettext(
              "An error occured while retrieving recipient information"
            ),
            err
          )
        }
      },
      async fetchMutualCreditLimits() {
        let accounts
        try {
          accounts = await this.$lokapi.getAccountfromRecipient(this.recipient)
        } catch (err: any) {
          console.error(
            "An unexpected server error occurred while fetching mutual credit limits",
            err
          )
          this.$msg.error(
            this.$gettext(
              "An unexpected server error occurred while fetching mutual credit limits"
            )
          )
        }
        let cmAccount = accounts.subAccounts.find(
          (acc: any) => acc._obj.type === "Cm"
        )

        let highLimit, lowLimit

        if (cmAccount) {
          try {
            highLimit = await cmAccount._obj.getHighLimit()
            lowLimit = await cmAccount._obj.getLowLimit()
          } catch (err: any) {
            console.error(
              "An unexpected server error occurred while fetching mutual credit limits",
              err
            )
            this.$msg.error(
              this.$gettext(
                "An unexpected server error occurred while fetching mutual credit limits"
              )
            )
          }
        }
        return { highLimit, lowLimit }
      },
      async initializeAccountForm() {
        const accountType = this.userAccount.isBusinessForFinanceBackend
          ? "professional"
          : "personal"
        const status = !!this.userAccount.isActiveAccount

        let { highLimit, lowLimit } = await this.fetchMutualCreditLimits()

        this.accountForm = {
          status,
          accountType,
          highLimit,
          lowLimit,
        }
        this.initialAccountForm = { ...this.accountForm }
        this.emitAccountFormChange()
      },

      emitAccountFormChange() {
        this.$emit("accountFormChange", {
          form: { ...this.accountForm },
          isChanged: this.isAccountFormChanged,
          isFormValid: !this.negativeLimitError && !this.positiveLimitError,
        })
      },

      openCreditMoney() {
        this.$modal.open("MoneyTransferModal", {
          recipient: this.recipient,
          account: this.userAccount,
          transactionType: "adminCredit",
          refreshAccounts: () => this.refreshAccounts(),
          refreshTransaction: () => this.refreshTransactions(),
        })
      },
      refreshTransactions() {
        //not userd for now
      },
      async refreshAccounts() {
        try {
          this.userAccount = await this.$lokapi.getAccountfromRecipient(
            this.recipient
          )
        } catch (err: any) {
          throw new UIError(
            this.$gettext(
              "An error occured while retrieving account information"
            ),
            err
          )
        }
      },
      parseLimitValue(value: any) {
        if (value === "" || value === null || value === undefined) {
          return null
        }
        if (typeof value === "number") {
          return Number.isNaN(value) ? null : value
        }
        const parsed = Number(value)
        return Number.isNaN(parsed) ? null : parsed
      },

      getRecipientByUri: applyDecorators(
        [showSpinnerMethod(".title-card")],
        async function (this: any) {
          const backends = await this.$lokapi.getBackends()
          const splitArray = this.selectedRecipient.internalId.split("/")
          const walletIdent = splitArray.pop()
          const currencyUri = splitArray.join("/")
          const [_, currencyIdent] = currencyUri.split(":")
          this.backend = backends[currencyUri]
          if (!this.backend) {
            throw new Error(`backend ${currencyUri} not found`)
          }

          let recipient
          try {
            recipient = await this.backend.searchRecipientByUri({
              rp: this.selectedRecipient.id,
              rpb: `${
                this.selectedRecipient.internalId.split(":")[0] +
                ":" +
                walletIdent
              }`,
            })
          } catch (err) {
            this.$msg.error(
              this.$gettext("An error occured while searching recipient")
            )
            throw err
          }
          return recipient
        }
      ),
    },
  })
  export default class AdminBackend extends Vue {}
</script>
<style lang="scss" scoped>
  @import "../assets/custom-variables";
  @import "@/assets/switch-prefs";
  .container {
    background-color: white;
    overflow-wrap: break-word;
  }
  .wallet-uri {
    font-size: 0.9em;
  }
  .section-card {
    padding: 1em;
  }

  .account-action-row {
    display: flex;
    align-items: left;
    justify-content: space-between;
    gap: 1rem;
  }

  .account-action-label {
    margin-bottom: 0;
    white-space: nowrap;
    margin: auto;
  }

  .account-action-control {
    align-items: start;
    width: 100%;
  }

  .account-action-column {
    flex-direction: column;
    align-items: flex-start;
  }

  .currency-limit-fields {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    width: 100%;
  }

  .currency-limit-field {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .currency-limit-input {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    width: 100%;
  }

  .currency-limit-label {
    margin-bottom: 0;
    min-width: fit-content;
    margin-top: 0.5em;
  }

  .title-card {
    font-size: 1em;
    font-weight: bold;
  }

  .recipient-actions-row {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 0.5rem;
  }

  .submit-button {
    justify-content: end;
  }
  .barter-label {
    margin-left: 0rem;
  }
</style>
