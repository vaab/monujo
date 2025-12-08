<template>
  <div class="tx-list-container">
    <div class="filter-area">
      <div class="ml-2 mt-2">
        <div
          class="
            is-flex-direction-column
            is-align-items-center
            is-justify-content-space-between
            mb-2
          "
        >
          <div class="mb-1">
            <strong>{{ $gettext("Select timespan:") }}</strong>
          </div>
          <div class="datepicker-export">
            <date-picker
              v-model:value="exportDate"
              :open="datePickerShow ? true : null"
              range
              prefix-class="xmx"
              :editable="false"
              :placeholder="$gettext('All transactions')"
              @clear="
                () => {
                  selectedTimeSpanType = ''
                  datePickerShow = false
                }
              "
              @change="datePickerShow = selectedTimeSpanType ? true : false"
              @pick="selectedTimeSpanType = ''"
              :disabled-date="disabledDates"
            >
              <template #header="{ emit }">
                <div>
                  <div
                    v-for="selector in selectorsOrder"
                    :class="{
                      selected: selector == selectedTimeSpanType,
                    }"
                    class="timespan"
                  >
                    <button
                      class="xmx-btn xmx-btn-text"
                      @click="
                        () => {
                          selectedTimeSpanOffset =
                            selectedTimeSpanType != selector
                              ? -1
                              : selectedTimeSpanOffset - 1
                          selectedTimeSpanType = selector
                          emit(selectedTimeSpan)
                        }
                      "
                    >
                      <i class="xmx-icon-left"></i>
                    </button>
                    <button
                      class="xmx-btn xmx-btn-text"
                      @click="
                        () => {
                          selectedTimeSpanType = selector
                          selectedTimeSpanOffset = 0
                          emit(selectedTimeSpan)
                        }
                      "
                    >
                      {{ selectorLabels[selector] }}
                    </button>
                    <button
                      class="xmx-btn xmx-btn-text"
                      @click="
                        ;[selectedTimeSpanOffset++, emit(selectedTimeSpan)]
                      "
                      :class="{
                        hide:
                          selectedTimeSpanType != selector ||
                          isSelectionCurrent,
                      }"
                    >
                      <i class="xmx-icon-right"></i>
                    </button>
                    <button
                      class="xmx-btn xmx-btn-text confirm"
                      @click="datePickerShow = false"
                      :class="{ hide: selectedTimeSpanType != selector }"
                    >
                      {{ $gettext("confirm") }}
                    </button>
                  </div>
                </div>
              </template>
            </date-picker>
          </div>
          <div class="mb-1 mt-3">
            <strong>{{ $gettext("Select recipient:") }}</strong>
          </div>
          <div class="recipient-filter is-flex is-flex-direction-row">
            <div class="recipient-filter-input">
              <model-list-select
                :list="
                  recipientBatchLoader.elements.reduce((acc, r, idx) => {
                    if (recipient?.internalId !== r.internalId)
                      acc.push({ name: r.name, idx })
                    return acc
                  }, [])
                "
                option-value="idx"
                option-text="name"
                v-model="selectedRecipientIdx"
                :placeholder="$gettext('All recipient')"
                @searchchange="onRecipientSearch"
                id="recipientSelector"
              >
              </model-list-select>
            </div>
            <div>
              <button
                class="recipient-filter-reset"
                :class="{ disable: selectedRecipientIdx === null }"
                @click="selectedRecipientIdx = null"
              >
                <fa-icon
                  class="refreshing"
                  v-if="recipientBatchLoader.isNewBatchLoading"
                  icon="sync"
                ></fa-icon>
                <fa-icon
                  v-else-if="selectedRecipientIdx !== null"
                  icon="fa-xmark"
                >
                </fa-icon>
                <fa-icon v-else icon="fa-user"></fa-icon>
              </button>
            </div>
          </div>
        </div>
      </div>
      <div
        class="
          mt-3is-flex
          is-justify-content-space-evenly is-align-items-center
        "
      ></div>
      <div class="container is-fluid custom-heavy-line-separator"></div>
    </div>
    <section
      ref="transactionsContainer"
      @scroll="transactionBatchLoader.getNextElements"
      class="modal-card-body"
    >
      <div class="tx-list">
        <div
          class="
            custom-card
            is-flex-direction-column
            is-align-items-center
            is-justify-content-space-between
            mb-4
          "
        >
          <TransactionItem
            v-for="transaction in transactionBatchLoader.elements"
            :key="transaction"
            :transaction="transaction"
            :account="account"
          />
          <div
            v-if="
              transactionBatchLoader.elements.length == 0 &&
              !transactionBatchLoader.isNewBatchLoading.value
            "
            class="is-flex is-align-items-center is-justify-content-center"
          >
            {{ $gettext("No transaction found") }}
          </div>
          <Loading
            v-if="transactionBatchLoader.isNewBatchLoading"
            v-model:active="transactionBatchLoader.isNewBatchLoading"
            class="loader-container"
            :can-cancel="false"
            :is-full-page="false"
            :width="30"
            :height="30"
          />
          <div
            v-if="
              transactionBatchLoader.hasNoMoreElements.value &&
              transactionBatchLoader.elements.value.length === 0
            "
            class="is-flex is-align-items-center is-justify-content-center"
          >
            {{ $gettext("No transactions found") }}
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
<script lang="ts">
  import { mapGetters } from "vuex"

  import { Options, Vue } from "vue-class-component"
  import Loading from "vue-loading-overlay"
  import DatePicker from "vue-datepicker-next"

  import { ModelListSelect } from "vue-search-select"
  import { Capacitor } from "@capacitor/core"
  import moment from "moment"

  import TransactionItem from "./TransactionItem.vue"

  import { UIError } from "../exception"

  // Assets

  import "vue-datepicker-next/index.css"
  import "vue-search-select/dist/VueSearchSelect.css"
  import "@/assets/datepicker.scss"

  import { mapModuleState } from "@/utils/vuex"
  import UseBatchLoading from "@/services/UseBatchLoading"

  import { showSpinnerMethod } from "@/utils/showSpinner"
  import applyDecorators from "@/utils/applyDecorators"
  import { debounceMethod } from "@/utils/debounce"

  import PdfDocument from "@/utils/pdf"
  import { jsPDF } from "jspdf"

  @Options({
    name: "TransactionList",
    components: {
      Loading,
      DatePicker,
      TransactionItem,
      ModelListSelect,
    },
    props: {
      recipient: Object,
      account: Object,
      showAll: Boolean,
    },
    expose: ["downloadCsvFile", "shareCsvFile", "downloadPdfFile"],

    data(this: any) {
      return {
        exportDate: ["", ""],
        datePickerShow: false,
        selectorLabels: {
          day: this.$gettext("day"),
          week: this.$gettext("week"),
          month: this.$gettext("month"),
          year: this.$gettext("year"),
        },
        selectorsOrder: ["day", "week", "month", "year"],
        selectedTimeSpanType: "",
        selectedTimeSpanOffset: 0,
        selectedRecipientIdx: null,
        recipientBatchLoader: null,
        isTransactionsLoading: false,
        transactionBatchLoader: {},
      }
    },

    created() {
      let account
      if (this.account._obj?.getTransactions) {
        account = this.account._obj
      } else {
        account = this.account._obj.parent
      }
      const backend = account.parent
      const searchRecipients = this.showAll
        ? backend.searchAllRecipients
        : backend.searchRecipients
      this.recipientBatchLoader = UseBatchLoading({
        genFactory: searchRecipients.bind(backend),
        needMorePredicate: () => {
          const div = this.$recipients
          if (!div) return false
          return div.scrollHeight - (div.scrollTop + div.offsetHeight) <= 50
        },
        onError: (e) => {
          this.$msg.error(
            this.$gettext(
              "An unexpected issue occured while downloading recipient list"
            )
          )
          throw e
        },
      })
      this.transactionBatchLoader = UseBatchLoading({
        genFactory: this.getTransactions.bind(this),
        needMorePredicate: () => {
          const div = this.$refs.transactionsContainer
          if (!div) return false
          return div.scrollHeight - (div.scrollTop + div.offsetHeight) <= 500
        },
        onError: () => {
          this.$msg.error(
            this.$gettext(
              "An unexpected issue occured while downloading transaction list"
            )
          )
        },
      })
    },

    mounted() {
      const $recipients = this.$el.querySelector(".menu")
      this._recipientsScroll = new AbortController()

      $recipients.addEventListener(
        "scroll",
        this.recipientBatchLoader.getNextElements.bind(
          this.recipientBatchLoader
        ),
        this._recipientsScroll
      )
      this.$recipients = $recipients
      this.recipientBatchLoader.newGen("")

      this.transactionBatchLoader.newGen("")
    },
    beforeUnmount() {
      this._recipientsScroll?.abort()
    },
    computed: {
      isSelectionCurrent(): boolean {
        return moment().isBetween(this.exportDate[0], this.exportDate[1])
      },
      selectedTimeSpan() {
        const now = moment().toDate()
        const timeSpanType = this.selectedTimeSpanType
        const offset = this.selectedTimeSpanOffset
        const dateSelected = moment(now)
          .subtract(-offset, timeSpanType)
          .toDate()
        const [begin, end] = [
          moment(dateSelected).startOf(timeSpanType),
          moment(dateSelected).endOf(timeSpanType),
        ].map((m) => m.toDate())

        return [begin, now < end ? now : end]
      },
      ...mapModuleState("lokapi", ["userProfile"]),
      ...mapGetters(["numericFormat", "dateFormat", "dateTimeFormat"]),
    },

    methods: {
      async *getTransactions() {
        const account = this.account
        let gen

        let selectedRecipientName = null

        if (account._obj?.getTransactions) {
          gen = account._obj.getTransactions()
        } else {
          gen = account._obj.parent.getTransactions()
        }
        selectedRecipientName =
          this.recipientBatchLoader.elements[this.selectedRecipientIdx]?.name

        const [dateBegin, dateEnd] = this.exportDate
        for await (const t of gen) {
          if (dateBegin && t.date < dateBegin) break
          if (selectedRecipientName && selectedRecipientName !== t.related)
            continue
          if (dateEnd && t.date > dateEnd) continue
          yield t
        }
      },
      async onRecipientSearch(recipientsSearchString: any) {
        if (
          this.selectedRecipientIdx !== null &&
          recipientsSearchString === ""
        ) {
          return
        }
        if (
          recipientsSearchString.length > 2 ||
          recipientsSearchString.length === 0
        ) {
          this.recipientBatchLoader.newGen(recipientsSearchString)
        }
      },

      async createCsvFile() {
        const transactions = []
        const [dateBegin, dateEnd] = this.exportDate

        this.isTransactionsLoading = true

        try {
          for await (const t of this.getTransactions()) {
            transactions.push(t)
          }
        } catch (e) {
          this.$msg.error(
            this.$gettext(
              "An unexpected issue occured while downloading transaction list"
            )
          )
          throw e
        } finally {
          this.isTransactionsLoading = false
        }

        let exportFileName
        if (dateBegin && dateEnd) {
          const dateBeginStr = moment(dateBegin).format("YYYY-MM-DD")
          const dateEndStr = moment(dateEnd).format("YYYY-MM-DD")
          exportFileName = `transactions_${dateBeginStr}_${dateEndStr}.csv`
        } else {
          exportFileName = "transactions.csv"
        }

        const columnOrder = [
          "sender",
          "receiver",
          "amount",
          "date",
          "description",
          ...(this.hasMoreThanOneSubAccount ? ["account"] : []),
        ]

        const csvDataLine: { [key: string]: string }[] = [
          {
            sender: this.$gettext("Source"),
            receiver: this.$gettext("Target"),
            amount: this.$gettext("Amount"),
            date: this.$gettext("Date"),
            description: this.$gettext("Description"),
            ...(this.hasMoreThanOneSubAccount && {
              account: this.$gettext("Account"),
            }),
          },
        ]

        for (let e of transactions) {
          const name = e.related
          const [sender, receiver] = e.amount.startsWith("-")
            ? [this.userProfile.name, name]
            : [name, this.userProfile.name]
          const accountType = e.tags.includes("barter")
            ? this.$gettext("mutual")
            : this.$gettext("reconvertible")
          const data: { [key: string]: string } = {
            sender,
            receiver,
            amount: this.numericFormat(e.amount),
            date: moment(e.date).format("YYYY-MM-DD HH:mm:ss"),
            description: e.description || "",
            ...(this.hasMoreThanOneSubAccount && {
              account: accountType,
            }),
          }

          for (const s of columnOrder) {
            data[s] = '"' + data[s].replaceAll('"', '""') + '"'
          }

          csvDataLine.push(data)
        }

        return {
          csvContent:
            csvDataLine
              .map((dataLine) =>
                columnOrder.map((header) => dataLine[header]).join(",")
              )
              .join("\r\n") + "\r\n",
          exportFileName,
        }
      },

      downloadPdfFile: applyDecorators(
        [debounceMethod, showSpinnerMethod(".modal-card-body")],
        async function (this: any): Promise<void> {

          const transactions: any[] = []
          const [dateBegin, dateEnd] = this.exportDate

          this.isTransactionsLoading = true

          let exportFileName
          if (dateBegin && dateEnd) {
            const dateBeginStr = moment(dateBegin).format("YYYY-MM-DD")
            const dateEndStr = moment(dateEnd).format("YYYY-MM-DD")
            exportFileName = `transactions_${dateBeginStr}_${dateEndStr}.pdf`
          } else {
            exportFileName = "transactions.pdf"
          }

          const columnOrder = [
            "date",
            "related",
            "description",
            "sent",
            "receive",
            ...(this.hasMoreThanOneSubAccount ? ["account"] : []),
          ]

          // let report = new PdfDocument(
          //   this.getTransactions(),
          //   dateBegin,
          //   dateEnd,
          //   this
          // )
          // dateBegin =  new Date("2025-07-01T16:09:02")
          // dateEnd =  new Date("2025-07-31T16:09:02")
let txs = [
  {
    date: new Date("2025-07-04T16:09:02"),
    related: "Biocop - Mon Épicerie Bio",
    description: "Caisse 1\nINV001032",
    amountUnit: -2500n,
    isTopUp: false,
    isReconversion: false,
  },
  {
    date: new Date("2025-07-04T09:15:23"),
    related: "Franprix République",
    description: "Paiement CB\nTicket 54032",
    amountUnit: -1240n,
    isTopUp: false,
    isReconversion: false,
  },
  {
    date: new Date("2025-07-03T14:55:10"),
    related: "Amazon Marketplace",
    description: "Order #A394-3920419-2841023",
    amountUnit: -5999n,
    isTopUp: false,
    isReconversion: false,
  },
  {
    date: new Date("2025-07-05T10:20:45"),
    related: "Paul Dupont",
    description: "Remboursement déjeuner lundi\nMerci !",
    amountUnit: 1520n,
    isTopUp: false,
    isReconversion: false,
  },
  {
    date: new Date("2025-07-02T17:45:32"),
    related: "Reconversion",
    description: "Conversion crypto vers EUR\nID: RCV-09201",
    amountUnit: -15000n,
    isTopUp: false,
    isReconversion: true,
  },
  {
    date: new Date("2025-07-01T08:12:08"),
    related: "Top-Up",
    description: "Virement bancaire reçu\nRef: TOPUP-7841",
    amountUnit: 20000n,
    isTopUp: true,
    isReconversion: false,
  },
  {
    date: new Date("2025-07-06T11:34:02"),
    related: "☎ Lidl Saint-Michel Troulalalère, hop et encore du contenu",
    description: "Alimentation\nTicket: 118923",
    amountUnit: -3420n,
    isTopUp: false,
    isReconversion: false,
  },
  {
    date: new Date("2025-07-05T19:00:00"),
    related: "Emma Leroy",
    description: "Participation cadeau mariage",
    amountUnit: 5000n,
    isTopUp: false,
    isReconversion: false,
  },
  {
    date: new Date("2025-07-03T13:09:12"),
    related: "Starbucks Opéra",
    description: "Latte + sandwich",
    amountUnit: -890n,
    isTopUp: false,
    isReconversion: false,
  },
  {
    date: new Date("2025-07-02T20:10:40"),
    related: "Reconversion",
    description: "Conversion solde virtuel -> EUR",
    amountUnit: -5000n,
    isTopUp: false,
    isReconversion: true,
  },
  {
    date: new Date("2025-07-01T15:48:20"),
    related: "Top-Up",
    description: "CB - Crédit Agricole\nTOPUP 2371",
    amountUnit: 10000n,
    isTopUp: true,
    isReconversion: false,
  },
  {
    date: new Date("2025-07-06T13:22:11"),
    related: "Fnac Montparnasse",
    description: "Livre: 'Deep Work'\nFacture #FNC-30321",
    amountUnit: -1890n,
    isTopUp: false,
    isReconversion: false,
  },
  {
    date: new Date("2025-07-04T18:05:50"),
    related: "Marché Bastille",
    description: "Fruits et légumes",
    amountUnit: -1120n,
    isTopUp: false,
    isReconversion: false,
  },
  {
    date: new Date("2025-07-05T21:00:00"),
    related: "Thomas Martin",
    description: "Resto samedi dernier\n🍝🍷",
    amountUnit: 3200n,
    isTopUp: false,
    isReconversion: false,
  },
  {
    date: new Date("2025-07-01T10:15:30"),
    related: "Monoprix Beaubourg",
    description: "Courses\nRef ticket: 008934",
    amountUnit: -2780n,
    isTopUp: false,
    isReconversion: false,
  },
  {
    date: new Date("2025-07-03T07:45:25"),
    related: "Decathlon Nation",
    description: "Chaussettes sport x3\nINV #DCT1281",
    amountUnit: -1550n,
    isTopUp: false,
    isReconversion: false,
  },
  {
    date: new Date("2025-07-04T12:12:12"),
    related: "Top-Up",
    description: "Stripe payment\nTOPUP-3490",
    amountUnit: 15000n,
    isTopUp: true,
    isReconversion: false,
  },
  {
    date: new Date("2025-07-05T14:23:19"),
    related: "Top-Up",
    description: "💳 Recharge CB – Crédit Mutuel\nTOPUP #CM7821",
    amountUnit: 30000n,
    isTopUp: true,
    isReconversion: false,
  },
  {
    date: new Date("2025-07-05T19:59:45"),
    related: "Le 🍓🧀🥖Marché des Saveurs 🍓🧀🥖",
    description: "Fromages + fruits frais\nStand n°4\nNotes du jour: délicieux !\nHop",
    amountUnit: -4250n,
    isTopUp: false,
    isReconversion: false,
  },
  {
    date: new Date("2025-07-06T22:15:03"),
    related: "📦 Amazon Prime – 日本アマゾン",
    description: "商品番号: JP-3829-00123\nヘッドホン + 保護ケース",
    amountUnit: -11890n,
    isTopUp: false,
    isReconversion: false,
  },
  {
    date: new Date("2025-07-02T08:30:00"),
    related: "Top-Up",
    description: "🚀 Instant Transfer via Lydia\nTOPUP #LD-98123",
    amountUnit: 48000n,
    isTopUp: true,
    isReconversion: false,
  },
  {
    date: new Date("2025-07-03T21:12:05"),
    related: "IKEA Villiers – Meubles & Déco",
    description: "Armoire BRIMNES + table LACK\nCommande n° IK-724839",
    amountUnit: -26990n,
    isTopUp: false,
    isReconversion: false,
  },
  {
    date: new Date("2025-07-01T14:10:22"),
    related: "Top-Up",
    description: "💰 Virement SEPA reçu de BNP Paribas",
    amountUnit: 100000n,
    isTopUp: true,
    isReconversion: false,
  },
  {
    date: new Date("2025-07-06T06:06:06"),
    related: "🚇 Navigo rechargement",
    description: "Pass mensuel – Juillet\nRef: IDNAVGO-33421",
    amountUnit: -8450n,
    isTopUp: false,
    isReconversion: false,
  },
  {
    date: new Date("2025-07-05T18:42:11"),
    related: "💼 Remboursement pro – Acme Corp.",
    description: "Déplacement client / Uber + déjeuner",
    amountUnit: 15800n,
    isTopUp: false,
    isReconversion: false,
  },
  {
    date: new Date("2025-07-02T11:11:11"),
    related: "ZARA 👗 – Val d'Europe",
    description: "Robe + accessoire été\nFacture ZR-A1283991",
    amountUnit: -5290n,
    isTopUp: false,
    isReconversion: false,
  },
  {
    date: new Date("2025-07-06T15:35:48"),
    related: "Lucas Navarro",
    description: "Paiement resto\nReçu #R233\n🦐🍷",
    amountUnit: 2400n,
    isTopUp: false,
    isReconversion: false,
  },
  {
    date: new Date("2025-07-04T23:59:59"),
    related: "Decathlon / Camping 🏕️",
    description: "Matelas gonflable + réchaud gaz",
    amountUnit: -6990n,
    isTopUp: false,
    isReconversion: false,
  },
  {
    date: new Date("2025-07-03T09:09:09"),
    related: "Maison Pradier – Petit déj ☕🥐",
    description: "Formule café + jus orange + croissant",
    amountUnit: -790n,
    isTopUp: false,
    isReconversion: false,
  },
  {
    date: new Date("2025-07-01T12:12:12"),
    related: "Reconversion",
    description: "Versement vers portefeuille épargne\nRCV-FND0023",
    amountUnit: -12000n,
    isTopUp: false,
    isReconversion: true,
  },
  {
    date: new Date("2025-07-06T13:03:37"),
    related: "Les Nouveaux Fermiers 🌱",
    description: "Simili viande + tofu\nPanier Bio #NLF0019",
    amountUnit: -3310n,
    isTopUp: false,
    isReconversion: false,
  },
  {
    date: new Date("2025-07-04T14:14:14"),
    related: "Martine Legrand-Marchand",
    description: "Paiement rétro pour ancien prêt familial\nAucun intérêt",
    amountUnit: 20000n,
    isTopUp: false,
    isReconversion: false,
  },
  {
    date: new Date("2025-07-03T15:00:00"),
    related: "🏕️ Gîtes de France – Réservation",
    description: "Accompte séjour août\nRéf: GDF2025-02-B-PL",
    amountUnit: -15000n,
    isTopUp: false,
    isReconversion: false,
  },
  {
    date: new Date("2025-07-01T09:05:00"),
    related: "Top-Up",
    description: "💳 CB Recharge automatique\nBanque Populaire",
    amountUnit: 18000n,
    isTopUp: true,
    isReconversion: false,
  },
  {
    date: new Date("2025-07-05T12:01:01"),
    related: "Séphora 👑 – Champs-Élysées",
    description: "Parfum cadeau 🎁\nRef: SFR-PF-77441",
    amountUnit: -11990n,
    isTopUp: false,
    isReconversion: false,
  },
  {
    date: new Date("2025-07-06T19:19:19"),
    related: "Reconversion",
    description: "Crypto selloff (ETH ➜ EUR)\nRCV-ETH-71231",
    amountUnit: -45000n,
    isTopUp: false,
    isReconversion: true,
  },
  {
    date: new Date("2025-07-02T16:29:00"),
    related: "🚕 G7 Taxi",
    description: "Aéroport CDG ➜ domicile\nFacture: TAX-82390",
    amountUnit: -6490n,
    isTopUp: false,
    isReconversion: false,
  },
  {
    date: new Date("2025-07-04T07:30:00"),
    related: "Top-Up",
    description: "🔁 Recharge rapide via Revolut",
    amountUnit: 52000n,
    isTopUp: true,
    isReconversion: false,
  },
  {
    date: new Date("2025-07-06T20:00:00"),
    related: "Darty 📺 – TV & Son",
    description: "Câble HDMI + multiprise\nFacture: DRT-A19202",
    amountUnit: -2290n,
    isTopUp: false,
    isReconversion: false,
  },
  {
    date: new Date("2025-07-01T20:20:20"),
    related: "Romain Thévenin",
    description: "Participation console Nintendo Switch 🎮, bon anniversaire !\nSinon, tout va bien ?\nHop",
    amountUnit: 9900n,
    isTopUp: false,
    isReconversion: false,
  },
]
          txs.sort((a, b) => b.date.getTime() - a.date.getTime())
    // recreate the async iterator
    let getTransactions = (async function* () {
      for (const tx of txs) yield tx
    })
          const report_contact_info = await this.$lokapi.getReportContactInformation()
          let report = new PdfDocument(
            {issuer: report_contact_info.issuer,
             user: report_contact_info.user,
             date: {
               begin: dateBegin,
               end: dateEnd
             },
            },
            getTransactions(),
            this
          )


          try {
            await report.generate()
          } catch (e) {
            throw new UIError(
              this.$gettext("An error occured while creating the PDF file"),
              e
            )
          } finally {
            this.isTransactionsLoading = false
          }

          //this.$modal.close()
          this.$msg.success(this.$gettext("Transaction list downloaded"))
        }
      ),

      downloadCsvFile: applyDecorators(
        [debounceMethod, showSpinnerMethod(".modal-card-body")],
        async function (this: any): Promise<void> {
          let csvComponents
          try {
            csvComponents = await this.createCsvFile()
          } catch (e) {
            throw new UIError(
              this.$gettext("An error occured while creating the CSV file"),
              e
            )
          }
          const { csvContent, exportFileName } = csvComponents

          try {
            await this.$export.download(csvContent, exportFileName, "text/csv")
          } catch (e) {
            this.$msg.error(
              this.$gettext("Transaction list could not be downloaded")
            )
            throw e
          }
          this.$modal.close()
          this.$msg.success(this.$gettext("Transaction list downloaded"))
        }
      ),
      async shareCsvFile() {
        const { csvContent, exportFileName } = await this.createCsvFile()
        let dateBeginStr, dateEndStr
        if (this.exportDate[0] && this.exportDate[1]) {
          dateBeginStr = moment(this.exportDate[0]).format("YYYY-MM-DD")
          dateEndStr = moment(this.exportDate[1]).format("YYYY-MM-DD")
        } else {
          dateBeginStr = ""
          dateEndStr = ""
        }

        const message =
          dateBeginStr && dateEndStr
            ? this.$gettext(
                "Transaction list from %{ dateBeginStr } to %{ dateEndStr }",
                {
                  dateBeginStr,
                  dateEndStr,
                }
              )
            : this.$gettext("Transaction list")

        try {
          await this.$export.share(csvContent, exportFileName, message)
        } catch (e) {
          this.$msg.error(
            this.$gettext("Transaction list could not be downloaded")
          )
          throw e
        }
        this.$modal.close()
        this.$msg.success(this.$gettext("Transaction list shared"))
      },
    },
    watch: {
      selectedRecipientIdx: async function (newIdx, oldIdx): Promise<void> {
        this.onRecipientSearch("")
        this.transactionBatchLoader.newGen()
        this.$emit("update:selectedRecipientIdx", this.selectedRecipientIdx)
      },
      exportDate: async function (newExportDate): Promise<void> {
        const [newBegin, newEnd] = newExportDate
        const [normBegin, normEnd] = [
          newBegin ? moment(newBegin).startOf("day").toDate() : null,
          newEnd ? moment(newEnd).endOf("day").toDate() : null,
        ]
        if (
          normBegin &&
          normEnd &&
          (+newBegin != +normBegin || +newEnd != +normEnd)
        ) {
          this.exportDate = [normBegin, normEnd]
          return
        }
        this.transactionBatchLoader.newGen()
        this.$emit("update:exportDate", this.exportDate)
      },
    },
  })
  export default class TransactionList extends Vue {}
</script>
<style lang="scss">
  @import "@/assets/custom-variables";

  div.selected {
    background-color: $color-1;
  }

  div.timespan {
    padding: 0;
    margin: 0;
    border-radius: 2em;
    width: 15em;
    display: grid;
    grid-template-columns: 2em 5em 2em 6em;

    button.xmx-btn {
      text-align: center;
      border-radius: 2em;

      &.confirm {
        margin-left: 1em;
        &,
        &:hover {
          background-color: $color-2;
          color: $color-1;
        }
      }
    }
  }
  .datepicker-export {
    .xmx-datepicker-range {
      width: auto !important;
    }
  }
  div.xmx-datepicker-content {
    user-select: none;
  }
  .filter-area {
    background: #f0faf9;
  }
  .recipient-filter {
    width: 16.2em;
  }
  .recipient-filter-reset {
    position: relative;
    right: 1.5em;
    top: 0.7em;
    opacity: 0.5;
    padding: 0;
    border: none;
    background: none;
    cursor: pointer;
    z-index: 99;
  }
  .recipient-filter-input {
    width: 100%;
  }
  .loader-container {
    position: relative;
    height: 80px;
  }
  .ui.fluid.dropdown > .dropdown.icon {
    display: none;
  }
  button.disable {
    pointer-events: none;
  }
  @media only screen and (min-height: 1024px) {
    .ui.selection.dropdown .menu {
      max-height: 20em !important;
    }
  }
  @media only screen and (max-height: 1023px) and (min-height: 768px) {
    .ui.selection.dropdown .menu {
      max-height: 12em !important;
    }
  }
  @media only screen and (max-height: 767px) {
    .ui.selection.dropdown .menu {
      max-height: 7em !important;
    }
  }
  .tx-list {
    max-height: 30em;
  }
  .tx-list-container {
    background-color: #f0faf9;
  }
</style>
