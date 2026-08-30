"use client"

import { useState } from "react"
import { Plus, RotateCcw, Trash2 } from "lucide-react"

import { useCheckSettings } from "@/components/settings-context"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import type { BodyField, BodyFieldRole } from "@/lib/probe/defaults"
import {
  applySampleJson,
  AUTH_KIND_OPTIONS,
  defaultSampleJson,
  FIELD_ROLE_OPTIONS,
  type CheckSettings,
} from "@/lib/settings"
import type { AuthKind } from "@/lib/probe/types"

const SHAPE_FIELD =
  "!grid min-w-0 grid-cols-[5.75rem_minmax(0,1fr)] items-center gap-x-3 *:data-[slot=field-label]:flex-none *:data-[slot=field-label]:whitespace-nowrap"

const SETTINGS_STACK =
  "grid grid-cols-[minmax(13rem,max-content)_minmax(0,1fr)] items-center gap-x-4 gap-y-3"

const SETTINGS_FIELD =
  "col-span-2 grid min-w-0 grid-cols-subgrid items-center gap-x-4 *:data-[slot=field-label]:flex-none *:data-[slot=field-label]:whitespace-nowrap"

function nextFieldKey(fields: readonly BodyField[]) {
  const used = new Set(fields.map((field) => field.key))
  let index = fields.length + 1
  while (used.has(`field_${index}`)) index += 1
  return `field_${index}`
}

export function SettingsForm() {
  const { settings, update, reset } = useCheckSettings()
  const [sample, setSample] = useState(defaultSampleJson)
  const [sampleError, setSampleError] = useState<string | null>(null)
  const [shapeOpen, setShapeOpen] = useState(false)

  function patch(partial: Partial<CheckSettings>) {
    update({ ...settings, ...partial })
  }

  function applySample() {
    try {
      update(applySampleJson(sample, settings))
      setSampleError(null)
      setShapeOpen(true)
    } catch (caught) {
      setSampleError(caught instanceof Error ? caught.message : "That JSON could not be read.")
    }
  }

  function updateField(index: number, next: BodyField) {
    const fields = settings.shape.fields.map((field, fieldIndex) =>
      fieldIndex === index ? next : field,
    )
    patch({ shape: { id: "custom", fields } })
  }

  function removeField(index: number) {
    const fields = settings.shape.fields.filter((_, fieldIndex) => fieldIndex !== index)
    patch({ shape: { id: "custom", fields } })
  }

  function addField() {
    const key = nextFieldKey(settings.shape.fields)
    patch({
      shape: {
        id: "custom",
        fields: [
          ...settings.shape.fields,
          { key, role: "custom", label: "New field", sample: "" },
        ],
      },
    })
  }

  function resetAll() {
    reset()
    setSample(defaultSampleJson())
    setSampleError(null)
    setShapeOpen(false)
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="scroll-mt-6 text-pretty text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="max-w-xl text-pretty text-sm text-muted-foreground">
          If you want to use a different translation API shape, paste it below and edit the labels
          accordingly.
        </p>
      </header>

      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between gap-3 px-4 py-4">
          <h2 className="text-sm font-medium">Request shape</h2>
          <Button type="button" variant="outline" onClick={resetAll}>
            <RotateCcw aria-hidden />
            Reset to default
          </Button>
        </div>
        <Separator />
        <div className="space-y-4 px-4 py-4">
          <Field>
            <FieldLabel htmlFor="sample-json">Sample JSON</FieldLabel>
            <Textarea
              id="sample-json"
              name="sampleJson"
              autoComplete="off"
              value={sample}
              spellCheck={false}
              aria-invalid={Boolean(sampleError)}
              aria-describedby={sampleError ? "sample-json-error" : undefined}
              onChange={(event) => {
                setSample(event.target.value)
                setSampleError(null)
              }}
              className="min-h-40 font-mono text-base md:text-xs"
            />
            {sampleError ? <FieldError id="sample-json-error">{sampleError}</FieldError> : null}
          </Field>
          <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={applySample}>
              Use this shape
            </Button>
          </div>
        </div>
        {shapeOpen ? (
          <>
            <Separator />
            <ul className="divide-y divide-border">
              {settings.shape.fields.map((field, index) => (
                <li key={`${field.key}-${index}`} className="space-y-3 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="min-w-0 truncate text-sm font-medium whitespace-nowrap">
                      {field.label || field.key}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-xs"
                      aria-label={`Remove ${field.label || field.key}`}
                      onClick={() => removeField(index)}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field orientation="horizontal" className={SHAPE_FIELD}>
                      <FieldLabel htmlFor={`field-label-${index}`}>Label</FieldLabel>
                      <Input
                        id={`field-label-${index}`}
                        name={`fieldLabel-${index}`}
                        autoComplete="off"
                        value={field.label}
                        className="min-w-0"
                        onChange={(event) =>
                          updateField(index, { ...field, label: event.target.value })
                        }
                      />
                    </Field>
                    <Field orientation="horizontal" className={SHAPE_FIELD}>
                      <FieldLabel htmlFor={`field-key-${index}`}>JSON key</FieldLabel>
                      <Input
                        id={`field-key-${index}`}
                        name={`fieldKey-${index}`}
                        autoComplete="off"
                        value={field.key}
                        spellCheck={false}
                        className="min-w-0 font-mono"
                        onChange={(event) =>
                          updateField(index, { ...field, key: event.target.value })
                        }
                      />
                    </Field>
                    <Field orientation="horizontal" className={SHAPE_FIELD}>
                      <FieldLabel htmlFor={`field-role-${index}`}>Use as</FieldLabel>
                      <Select
                        id={`field-role-${index}`}
                        name={`fieldRole-${index}`}
                        value={field.role}
                        items={FIELD_ROLE_OPTIONS.map((item) => ({
                          value: item.value,
                          label: item.label,
                        }))}
                        onValueChange={(next) => {
                          if (typeof next !== "string") return
                          updateField(index, { ...field, role: next as BodyFieldRole })
                        }}
                      >
                        <SelectTrigger className="min-w-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FIELD_ROLE_OPTIONS.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field orientation="horizontal" className={SHAPE_FIELD}>
                      <FieldLabel htmlFor={`field-sample-${index}`}>Sample</FieldLabel>
                      <Input
                        id={`field-sample-${index}`}
                        name={`fieldSample-${index}`}
                        autoComplete="off"
                        value={field.sample}
                        className="min-w-0"
                        onChange={(event) =>
                          updateField(index, { ...field, sample: event.target.value })
                        }
                      />
                    </Field>
                  </div>
                </li>
              ))}
            </ul>
            <div className="border-t border-border px-4 py-3">
              <Button type="button" variant="outline" onClick={addField}>
                <Plus aria-hidden />
                Add field
              </Button>
            </div>
          </>
        ) : null}
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <h2 className="px-4 py-4 text-sm font-medium">Authentication</h2>
        <Separator />
        <div className={`${SETTINGS_STACK} px-4 py-4`}>
          <Field orientation="horizontal" className={SETTINGS_FIELD}>
            <FieldLabel htmlFor="auth-kind">Send token in</FieldLabel>
            <Select
              id="auth-kind"
              name="authKind"
              value={settings.authKind}
              items={AUTH_KIND_OPTIONS.map((item) => ({ value: item.value, label: item.label }))}
              onValueChange={(next) => {
                if (typeof next !== "string") return
                patch({ authKind: next as AuthKind })
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AUTH_KIND_OPTIONS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field orientation="horizontal" className={SETTINGS_FIELD}>
            <FieldLabel htmlFor="auth-key">Token field</FieldLabel>
            <Input
              id="auth-key"
              name="authKey"
              autoComplete="off"
              value={settings.authKey}
              spellCheck={false}
              className="font-mono"
              onChange={(event) => patch({ authKey: event.target.value })}
            />
          </Field>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <h2 className="px-4 py-4 text-sm font-medium">Thresholds</h2>
        <Separator />
        <div className={`${SETTINGS_STACK} px-4 py-4`}>
          <Field orientation="horizontal" className={SETTINGS_FIELD}>
            <FieldLabel htmlFor="settings-latency">Default maximum delay</FieldLabel>
            <Input
              id="settings-latency"
              name="latencyMs"
              type="number"
              inputMode="numeric"
              autoComplete="off"
              min={1}
              value={settings.latencyMs}
              className="w-24 tabular-nums"
              onChange={(event) => patch({ latencyMs: Number(event.target.value) || 1 })}
            />
          </Field>
          <Field orientation="horizontal" className={SETTINGS_FIELD}>
            <FieldLabel htmlFor="empty-path">Empty response path</FieldLabel>
            <Input
              id="empty-path"
              name="emptyPath"
              autoComplete="off"
              value={settings.emptyPath}
              spellCheck={false}
              className="font-mono"
              onChange={(event) => patch({ emptyPath: event.target.value })}
            />
          </Field>
          <Field orientation="horizontal" className={SETTINGS_FIELD}>
            <FieldLabel htmlFor="flag-empty">Flag empty responses</FieldLabel>
            <Checkbox
              id="flag-empty"
              name="flagEmpty"
              checked={settings.flagEmpty}
              aria-label="Flag empty responses"
              onCheckedChange={(value) => patch({ flagEmpty: value === true })}
            />
          </Field>
        </div>
      </section>
    </div>
  )
}
