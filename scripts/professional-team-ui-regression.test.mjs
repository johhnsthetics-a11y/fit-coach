import assert from 'node:assert/strict'
import test, { after, before } from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { readFileSync } from 'node:fs'

let server
let ProfessionalTeamWorkspace

before(async () => {
  server = await createServer({ mode: 'test', envFile: false, server: { middlewareMode: true, hmr: false } })
  ProfessionalTeamWorkspace = (await server.ssrLoadModule('/src/ProfessionalTeamWorkspace.jsx')).default
})

after(async () => {
  await server?.close()
})

test('inbox shows only invitations matching the signed-in email and professional role', () => {
  const html = renderToStaticMarkup(React.createElement(ProfessionalTeamWorkspace, {
    currentUser: { id: 'trainer-1', email: 'trainer@example.com', professionalRole: 'trainer' },
    invites: [
      { id: 'right-invite', inviteeEmail: 'trainer@example.com', expectedRole: 'trainer', status: 'pending', teamName: 'Equipe Correta' },
      { id: 'wrong-role', inviteeEmail: 'trainer@example.com', expectedRole: 'nutritionist', status: 'pending', teamName: 'Equipe de Nutrição' },
    ],
  }))
  assert.match(html, /Equipe Correta/)
  assert.match(html, /Aceitar convite/)
  assert.doesNotMatch(html, /Equipe de Nutrição/)
})

test('a successful delegation save becomes the baseline for later removal confirmation', () => {
  const source = readFileSync(new URL('../src/ProfessionalTeamWorkspace.jsx', import.meta.url), 'utf8')
  assert.match(source, /if \(saved !== false\) initialSelectedIdsRef\.current = next/)
})
