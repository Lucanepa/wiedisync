/**
 * KSCW Messaging — endpoint skeleton (Plan 01).
 *
 * All routes return 501 Not Implemented. Plan 02+ fill in the bodies.
 */

const stub = (name) => (req, res) => res.status(501).json({
  code: 'messaging/not_implemented',
  message: `Route ${name} not implemented yet (messaging plan 01 skeleton)`,
  details: { route: name, method: req.method, path: req.path },
})

export function registerMessaging(router, context) {
  const mount = (method, path, name) => router[method](path, stub(name))

  // Conversations
  mount('get',  '/messaging/conversations',                 'GET /conversations')
  mount('post', '/messaging/conversations/dm',              'POST /conversations/dm')
  mount('post', '/messaging/conversations/:id/read',        'POST /conversations/:id/read')
  mount('post', '/messaging/conversations/:id/mute',        'POST /conversations/:id/mute')
  mount('post', '/messaging/conversations/:id/clear',       'POST /conversations/:id/clear')

  // Messages
  mount('post',   '/messaging/messages',                    'POST /messages')
  mount('patch',  '/messaging/messages/:id',                'PATCH /messages/:id')
  mount('delete', '/messaging/messages/:id',                'DELETE /messages/:id')

  // Reactions
  mount('post', '/messaging/messages/:id/reactions',        'POST /messages/:id/reactions')

  // Requests & blocks
  mount('post',   '/messaging/requests/:id/accept',         'POST /requests/:id/accept')
  mount('post',   '/messaging/requests/:id/decline',        'POST /requests/:id/decline')
  mount('post',   '/messaging/blocks',                      'POST /blocks')
  mount('delete', '/messaging/blocks/:member',              'DELETE /blocks/:member')

  // Moderation
  mount('post',  '/messaging/reports',                      'POST /reports')
  mount('get',   '/messaging/reports',                      'GET /reports')
  mount('patch', '/messaging/reports/:id',                  'PATCH /reports/:id')

  // Settings & export
  mount('patch', '/messaging/settings',                     'PATCH /settings')
  mount('post',  '/messaging/settings/consent',             'POST /settings/consent')
  mount('post',  '/messaging/export',                       'POST /export')
}
