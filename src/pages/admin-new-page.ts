// The "new election" form. A new election always starts as a draft, so nothing
// here is visible to voters yet.

import { createElection } from '../api'
import { fromLocalInput, icon, pageHead, toLocalInput, toast } from '../ui'
import { Page } from '../types'
import { bindElectionForm, electionFormHtml } from './election-form'

export function adminNewPage(): Page {
  return {
    title: 'New election',

    // Nothing to fetch here — the form is the whole page.
    async render() {
      const defaults = {
        title: '',
        description: null,
        startsAt: toLocalInput(new Date(Date.now() + 86_400_000).toISOString()), // opens tomorrow
        endsAt: toLocalInput(new Date(Date.now() + 4 * 86_400_000).toISOString()), // closes in four days
      }

      return `<a class="back-link" href="#/admin">${icon('arrowLeft', 15)} Administration</a>
        ${pageHead('New election', 'New elections start as drafts — configure everything, then open voting.')}
        <div class="card form-card">${electionFormHtml(defaults, 'Create draft election')}</div>`
    },

    bind(root) {
      bindElectionForm(root, async (values) => {
        const election = await createElection({
          title: values.title,
          description: values.description,
          startsAt: fromLocalInput(values.startsAt),
          endsAt: fromLocalInput(values.endsAt),
        })
        toast('Election created as draft', 'success')
        location.hash = `#/admin/elections/${election.id}`
      })
    },
  }
}
