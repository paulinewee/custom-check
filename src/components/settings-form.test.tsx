import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { SettingsForm } from "@/components/settings-form"
import { SettingsProvider } from "@/components/settings-context"
import { SETTINGS_KEY } from "@/lib/settings"

function renderSettings() {
  return render(
    <SettingsProvider>
      <SettingsForm />
    </SettingsProvider>,
  )
}

describe("SettingsForm", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    window.localStorage.clear()
  })

  it("reveals Huniki fields after applying a shape and hides them on reset", async () => {
    const user = userEvent.setup()
    renderSettings()

    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Request shape" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Reset to default" })).toBeInTheDocument()
    expect(screen.queryByLabelText("JSON key")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Add field" })).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Use this shape" }))
    expect(screen.getAllByLabelText("JSON key")[0]).toHaveValue("text")

    const sample = screen.getByLabelText("Sample JSON")
    await user.clear(sample)
    await user.click(sample)
    await user.paste('{"q":"Hi","from":"en","to":"fr"}')
    await user.click(screen.getByRole("button", { name: "Use this shape" }))

    const keys = screen.getAllByLabelText("JSON key")
    expect(keys.map((item) => (item as HTMLInputElement).value)).toEqual(["q", "from", "to"])

    await user.click(screen.getByRole("button", { name: "Reset to default" }))
    expect(screen.queryByLabelText("JSON key")).not.toBeInTheDocument()
    expect(window.localStorage.getItem(SETTINGS_KEY)).toBeTruthy()

    await user.click(screen.getByRole("button", { name: "Use this shape" }))
    expect((screen.getAllByLabelText("JSON key")[0] as HTMLInputElement).value).toBe("text")
  })

  it("keeps fields hidden when the sample JSON is invalid", async () => {
    const user = userEvent.setup()
    renderSettings()

    const sample = screen.getByLabelText("Sample JSON")
    await user.clear(sample)
    await user.click(sample)
    await user.paste("{not json")
    await user.click(screen.getByRole("button", { name: "Use this shape" }))

    expect(screen.getByRole("alert")).toBeInTheDocument()
    expect(screen.queryByLabelText("JSON key")).not.toBeInTheDocument()
  })
})
