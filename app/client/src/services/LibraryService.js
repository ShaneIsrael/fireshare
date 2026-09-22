import Api from './Api'

// Library maintenance that spans videos and images alike.
const service = {
  // Progress of the current or last "find moved files" scan, plus how many
  // records are currently missing from disk.
  relinkStatus() {
    return Api().get('/api/manual/relink/status')
  },
  startRelinkScan() {
    return Api().post('/api/manual/relink/scan')
  },
  // items: [{ kind: 'video' | 'image', id, new_path }]. Each file is hashed again
  // before its record is updated, which can take a moment for a long list.
  applyRelink(items) {
    return Api().post('/api/manual/relink/apply', { items }, { timeout: 120000 })
  },
}

export default service
