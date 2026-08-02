import { defineConfig } from "cypress";

export default defineConfig({
  allowCypressEnv: false,

  e2e: {
    baseUrl: "http://localhost:3000",
    setupNodeEvents(on, config) {
      let tableId: any

      on('task', {
        setTableId(id) {
          tableId = id
          return null
        },
        getTableId() {
          return tableId
        }
      })

      return config
    },
  },
});
