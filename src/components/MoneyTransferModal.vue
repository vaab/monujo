<template>
  <div class="modal is-active">
    <div class="modal-background"></div>
    <template v-if="$modal.step.value == 1">
      <div class="modal-card">
        <header class="modal-card-head">
          <p class="modal-card-title is-title-shrink">
            {{ $gettext("Send money") }} - 1/2
          </p>
          <button class="delete" aria-label="close" @click="close()"></button>
        </header>
        <div class="search-area">
          <div
            class="
              mt-4
              is-flex is-justify-content-space-evenly is-align-items-center
              custom-search-bar
            "
          >
            <p class="control has-icons-left custom-search-bar">
              <input
                v-model="recipientsSearchString"
                @input="
                  (e) => {
                    ;(recipientsSearchString = e.target.value),
                      this.recipientsSearchString.length === 0 ||
                      this.recipientsSearchString.length >= 3
                        ? this.searchRecipients()
                        : null
                  }
                "
                class="input"
                type="text"
                :placeholder="$gettext('Name, email address or phone number')"
                ref="searchRecipient"
              />
              <span class="icon is-small is-left">
                <fa-icon icon="search" />
              </span>
            </p>
          </div>
          <div
            class="
              is-flex is-justify-content-space-evenly is-align-items-center
              mt-3
            "
          ></div>
          <div class="container is-fluid custom-heavy-line-separator"></div>
        </div>
        <section class="modal-card-body">
          <div v-if="recipientsLoading" class="loader-container">
            <loading
              v-model:active="recipientsLoading"
              :can-cancel="false"
              :is-full-page="false"
              :width="50"
              :height="50"
            />
          </div>
          <div
            v-else-if="recipientsSearchError"
            class="notification is-light is-danger"
          >
            {{
              $gettext(
                "An unexpected issue occurred while performing recipient lookup. " +
                  "We apologise for the inconvenience."
              )
            }}
          </div>
          <div v-else>
            <div
              v-if="ownCurrenciesRecipients.length !== 0"
              class="
                custom-card
                is-flex-direction-column
                is-align-items-center
                is-justify-content-space-between
              "
            >
              <template v-if="ownCurrenciesRecipients">
                <div
                  class="is-clickable py-2"
                  v-for="(recipient, index) in ownCurrenciesRecipients"
                >
                  <RecipientItem
                    :recipient="recipient"
                    :key="index"
                    @select="handleClickRecipient(recipient)"
                  />
                </div>
              </template>
            </div>
            <div
              v-else
              class="is-flex is-align-items-center is-justify-content-center"
            >
              {{ $gettext("No recipient found") }}
            </div>
          </div>
        </section>
        <footer class="modal-card-foot is-justify-content-flex-end">
          <!--  <button class="button is-success">Save changes</button>
        <button class="button">Cancel</button> -->
        </footer>
      </div>
    </template>
    <template v-if="$modal.step.value == 2 && selectedRecipient">
      <div class="modal-card">
        <header class="modal-card-head">
          <span class="is-flex is-flex-shrink-0">
            <a
              class="mr-3 is-flex"
              @click="$modal.back(), setFocus('searchRecipient')"
            >
              <span class="icon has-text-white">
                <fa-icon icon="arrow-left" class="fa-lg" />
              </span>
            </a>
          </span>
          <p class="modal-card-title is-title-shrink">
            {{ $gettext("Send money") }} - 2/2
          </p>
          <button class="delete" aria-label="close" @click="close()"></button>
        </header>
        <section class="modal-card-body">
          <div
            class="
              is-flex is-flex-direction-column is-justify-content-space-evenly
            "
          >
            <div class="is-flex is-flex-direction-column custom-amount-input">
              <h2 class="frame3-sub-title mb-3">
                {{ $gettext("From") }}
              </h2>
              <BankAccountItem
                :bal="ownSelectedAccount.bal"
                :curr="ownSelectedAccount.curr"
                :backend="ownSelectedAccount.backend"
                :type="ownSelectedAccount.type"
                :active="ownSelectedAccount.active"
                class="mb-4"
              >
                <template v-slot:name>{{ ownSelectedAccount.name() }}</template>
              </BankAccountItem>
              <h2 class="frame3-sub-title mb-3">
                {{ $gettext("To") }}
              </h2>
              <RecipientItem :recipient="selectedRecipient" />
              <h2 class="frame3-sub-title mt-3 mb-3">
                {{ $gettext("Amount") }}
              </h2>
              <div class="is-flex">
                <input
                  v-model.number="amount"
                  ref="amountSend"
                  type="number"
                  min="0"
                  class="input is-custom"
                  id="send-amount-input"
                  :placeholder="$gettext('e.g. 50')"
                  :class="{
                    'is-danger': errors.balance || errors.amount,
                  }"
                />
                <div class="amount-currency-symbol pl-2">
                  {{ selectedRecipient.currencySymbol }}
                </div>
              </div>
              <div
                class="notification is-danger is-light"
                v-if="errors.balance"
              >
                {{ errors.balance }}
              </div>
              <div class="notification is-danger is-light" v-if="errors.amount">
                {{ errors.amount }}
              </div>
              <textarea
                v-model="message"
                class="custom-textarea textarea mt-5"
                :placeholder="$gettext('Add a memo (optional)')"
              ></textarea>
            </div>
          </div>
        </section>
        <footer
          class="
            modal-card-foot
            custom-modal-card-foot
            is-justify-content-flex-end
          "
        >
          <button
            class="button custom-button-modal has-text-weight-medium"
            id="send-money-button"
            @click="sendTransaction()"
          >
            {{ $gettext("Send") }}
          </button>
        </footer>
      </div>
    </template>
  </div>
</template>
<script lang="ts">
  import { Options, Vue } from "vue-class-component"
  import { e as LokapiExc } from "@lokavaluto/lokapi-browser"

  import Loading from "vue-loading-overlay"
  import "vue-loading-overlay/dist/css/index.css"
  import RecipientItem from "@/components/RecipientItem.vue"
  import BankAccountItem from "@/components/BankAccountItem.vue"

  @Options({
    name: "MoneyTransferModal",
    components: {
      Loading,
      RecipientItem,
      BankAccountItem,
    },
    data() {
      return {
        recipients: [],
        displayFavoritesOnly: false,
        recipientsSearchString: "",
        transferOngoing: false,
        recipientsSearchError: false,
        selectedRecipient: null,
        ownSelectedAccount: null,
        amount: null,
        message: null,
        errors: {
          balance: false,
          amount: false,
        },
        nonce: 0,
        lastNonceReceived: 0,
      }
    },
    mounted() {
      this.setFocus("searchRecipient")
      this.searchRecipients()
    },
    computed: {
      ownCurrenciesRecipients(): Array<any> {
        let currencyIds = this.$store.getters.activeVirtualAccounts.map(
          (a: any) => a.currencyId
        )
        return this.recipients.filter((p: any) => {
          return currencyIds.indexOf(p.backendId) > -1
        })
      },
      recipientsLoading(): boolean {
        return this.nonce !== this.lastNonceReceived
      },
    },
    methods: {
      async searchRecipients(): Promise<void> {
        let requestNonce = ++this.nonce
        this.recipients = []
        this.recipientsSearchError = false
        let recipients
        let error = false
        try {
          recipients = await this.$lokapi.searchRecipients(
            this.recipientsSearchString
          )
        } catch (err: any) {
          error = err
        }
        if (requestNonce < this.lastNonceReceived) {
          return // obsolete request
        }
        if (error) {
          this.recipientsSearchError = true
          console.log("searchRecipients() Failed", error)
        }
        this.lastNonceReceived = requestNonce
        this.recipients = this.displayFavoritesOnly
          ? recipients.filter((r: any) => r.is_favorite === true)
          : recipients
      },
      async handleClickRecipient(recipient: any): Promise<void> {
        this.selectedRecipient = recipient
        this.selectedRecipient.currencySymbol = await recipient.getSymbol()
        this.ownSelectedAccount =
          this.$store.getters.activeVirtualAccounts.find(
            (va: any) => va.currencyId === recipient.backendId
          )
        this.$modal.next()
        this.errors.balance = false
        this.errors.amount = false
        this.setFocus("amountSend")
      },
      async sendTransaction(): Promise<void> {
        if (this.transferOngoing) {
          console.log(
            "Debounced `sendTransaction()` call as another transfer is ongoing..."
          )
          return
        }
        this.transferOngoing = true

        this.errors.amount = false
        this.errors.balance = false
        if (this.amount <= 0) {
          this.errors.amount = this.$gettext(
            "Amount to send must be greater than 0"
          )
          this.transferOngoing = false
          return
        }
        // This to ensure we are left with 2 decimals only
        this.amount = parseFloat(this.amount).toFixed(2)
        try {
          this.$store.commit("setRequestLoadingAfterCreds", true)
          await this.selectedRecipient.transfer(
            this.amount.toString(),
            this.message
          )
        } catch (err: any) {
          if (err instanceof LokapiExc.InsufficientBalance) {
            this.errors.balance = this.$gettext(
              "Transaction was refused due to insufficient balance"
            )
            return
          }
          if (err instanceof LokapiExc.InactiveAccount) {
            this.$msg.error(
              this.$gettext("Target account is inactive.") +
                "<br/>" +
                this.$gettext("You can't send money to this account.")
            )
            return
          }
          if (err.message === "User canceled the dialog box") {
            // A warning message should have already been sent
            return
          }
          this.$msg.error(
            this.$gettext(
              "An unexpected issue occurred during the money transfer. " +
                "We are sorry for the inconvenience."
            ) +
              "<br/>" +
              this.$gettext(
                "You can try again. If the issue persists, " +
                  "please contact your administrator."
              )
          )

          console.log("Payment failed:", err.message)
          throw err
        } finally {
          this.transferOngoing = false
          this.$loading.hide()
          this.$store.commit("setRequestLoadingAfterCreds", false)
        }
        this.errors.balance = false
        this.errors.amount = false
        this.close()
        this.$msg.success(
          this.$gettext("Payment issued to %{ name }", {
            name: this.selectedRecipient.name,
          })
        )
        if (!this.selectedRecipient.is_favorite) {
          this.$dialog
            .show({
              title: this.$gettext("Add as favorite"),
              content: this.$gettext(
                "Do you want to add %{ name } to your favorite list ?",
                { name: this.selectedRecipient.name }
              ),
              buttons: [
                { label: this.$gettext("Add"), id: "add" },
                { label: this.$gettext("Later"), id: "later" },
              ],
            })
            .then(async (result: any) => {
              if (result === "later") return
              try {
                await this.selectedRecipient.toggleFavorite()
              } catch (err: any) {
                // XXXvlab: using ``.then`` makes it trigger outside of
                // view js grasp.
                this.$errorHandler(err)
                return
              }
              this.$msg.success(
                this.$gettext("%{ name } was added to your favorite list", {
                  name: this.selectedRecipient.name,
                })
              )
            })
        }
        await this.$store.dispatch("fetchAccounts")
        await this.$store.dispatch("resetTransactions")
      },
      close() {
        this.searchName = ""
        this.recipients = []
        this.amount = 0
        this.activeClass = 0
        this.$modal.close()
      },
      setFocus(refLabel: string) {
        this.$nextTick(() => {
          const ref = this.$refs[refLabel]
          ref.focus()
          ref.select()
        })
      },
    },
  })
  export default class MoneyTransferModal extends Vue {}
</script>
<style lang="scss" scoped>
  @import "@/assets/custom-variables";

  .search-area {
    background: #f0faf9;
  }
  .button.action {
    white-space: normal;
    height: auto;
  }
  .card-recipient-wrapper {
    width: 90%;
  }
  .favorit-icon-wrapper {
    width: 10%;
  }
  .modal-card-body {
    min-height: 120px;
  }
  .loader-container {
    position: relative;
    height: 80px;
  }
  .amount-currency-symbol {
    margin: auto;
    font-size: 1.25em;
    font-weight: bold;
    line-height: 1em;
    padding-bottom: calc(0.5em - 1px);
    padding-left: calc(0.75em - 1px);
    padding-right: calc(0.75em - 1px);
    padding-top: calc(0.5em - 1px);
  }
  .w-100 {
    width: 100%;
  }
  .custom-search-bar {
    width: 89%;
    margin: auto;
  }

  .custom-search-bar input {
    background: #ffffff;
    border: 1px solid #e8e8e8;
    border-radius: 24px;
    width: 100% !important;
  }

  .custom-pictogram-search svg {
    width: 24px !important;
    height: 24px !important;
  }

  .custom-pictogram-search path,
  rect {
    fill: $color-2 !important;
    background: $color-2 !important;
  }

  .custom-button-pictogram {
    background-color: inherit !important;
    border: none;
    cursor: pointer;
  }
</style>
