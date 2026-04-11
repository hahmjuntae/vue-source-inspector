<template>
  <main class="app-shell">
    <section class="hero">
      <p class="eyebrow">Vue Source Inspector Demo</p>
      <h1>Layered Vue components for local extension testing</h1>
      <p class="intro">
        Hover the search controls, cards, and action buttons to verify `Nearest`, `Parent`, and
        `Page` source resolution in the extension.
      </p>
    </section>

    <SearchLayout>
      <template #title>
        <div class="toolbar">
          <div>
            <p class="toolbar-label">Coupon Search</p>
            <h2>Promotions Control Desk</h2>
          </div>
          <PrimaryButton label="Create Coupon" />
        </div>
      </template>

      <template #search>
        <div class="search-grid">
          <FormRow label="Campaign name">
            <TextField
              v-model="filters.campaign"
              placeholder="Spring early-bird promotion"
            />
          </FormRow>

          <FormRow label="Audience">
            <TextField
              v-model="filters.audience"
              placeholder="VIP / Dormant / New users"
            />
          </FormRow>

          <FormRow label="Status">
            <SegmentTabs
              v-model="filters.status"
              :options="['Draft', 'Running', 'Expired']"
            />
          </FormRow>

          <FormRow label="Notes">
            <TextField
              v-model="filters.notes"
              placeholder="Hover each element to test component resolution"
            />
          </FormRow>
        </div>
      </template>
    </SearchLayout>

    <section class="cards">
      <ResultCard
        title="Coupon Issued"
        value="18,240"
        description="Nearest result should often land on card internals like buttons and labels."
      />
      <ResultCard
        title="Conversion"
        value="13.4%"
        description="Parent should move up into row or card wrappers while Page stays at App."
      />
      <ResultCard
        title="Recovered Users"
        value="4,903"
        description="Use these cards to capture clean screenshots for the Chrome Web Store."
      />
    </section>
  </main>
</template>

<script setup>
import { reactive } from "vue";
import FormRow from "./components/FormRow.vue";
import PrimaryButton from "./components/PrimaryButton.vue";
import ResultCard from "./components/ResultCard.vue";
import SearchLayout from "./components/SearchLayout.vue";
import SegmentTabs from "./components/SegmentTabs.vue";
import TextField from "./components/TextField.vue";

const filters = reactive({
  campaign: "",
  audience: "",
  status: "Draft",
  notes: ""
});
</script>

<style scoped>
:global(*) {
  box-sizing: border-box;
}

:global(body) {
  margin: 0;
  min-height: 100vh;
  background:
    radial-gradient(circle at top left, rgba(0, 114, 245, 0.14), transparent 35%),
    linear-gradient(180deg, #f7f9fc 0%, #eef2f8 100%);
  color: #101828;
  font-family:
    "Geist",
    "Inter",
    "Segoe UI",
    sans-serif;
}

.app-shell {
  width: min(1120px, calc(100vw - 40px));
  margin: 0 auto;
  padding: 48px 0 72px;
}

.hero {
  margin-bottom: 26px;
}

.eyebrow {
  margin: 0 0 10px;
  color: #1768df;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.hero h1 {
  margin: 0;
  font-size: clamp(30px, 5vw, 46px);
  line-height: 1.04;
  letter-spacing: -0.04em;
}

.intro {
  width: min(660px, 100%);
  margin: 14px 0 0;
  color: #475467;
  font-size: 16px;
  line-height: 1.65;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
}

.toolbar-label {
  margin: 0 0 8px;
  color: #667085;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.toolbar h2 {
  margin: 0;
  font-size: 28px;
  letter-spacing: -0.04em;
}

.search-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px 18px;
}

.cards {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  margin-top: 20px;
}

@media (max-width: 860px) {
  .toolbar,
  .cards,
  .search-grid {
    grid-template-columns: 1fr;
  }

  .toolbar {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
