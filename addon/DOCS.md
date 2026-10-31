# HA Spending

The HA Spending add-on shows a household's spending from Firefly III on a page in Home Assistant. The page shows the
spending of a period as main groups, then categories, then postings, and compares a unit of the chosen grouping with
the one before it. Nothing is written to Firefly III.

## Installation

1. In Home Assistant go to *Settings → Apps → Install app → ⋮ → Repositories* and add
   `https://github.com/thomas3650/Ha-Spending`.
2. Install the *HA Spending* app and start it.
3. On the add-on's page turn on *Show in sidebar*. The page is then *Forbrug* in the sidebar. You can also open it with
   *Open web UI*.

## Configuration

| Option | What it is |
| --- | --- |
| `firefly_url` | Firefly III's address as the add-on reaches it. Required. |
| `firefly_token` | A Personal Access Token from Firefly III (*Options → Profile → OAuth*). The add-on only reads with it. Required. |
| `firefly_link_url` | Firefly III's address as your browser reaches it. When set, a posting opens there. Optional. |
| `main_group_rule_group` | The Firefly III rule group whose rules put categories into main groups. Default `Hovedgrupper`. |
| `excluded_main_groups` | Main groups that are not spending, such as money moved in and out. Default `Penge ind og ud`. |

Without `firefly_url` and `firefly_token` the add-on stops and says so in its log.

## Network

The page is reached through Home Assistant only (Ingress). The add-on publishes no port, and it refuses every request
that does not come through Home Assistant. The add-on reaches Firefly III at `firefly_url`, so that address must work
from inside Home Assistant.

## The page

The page is in Danish and has a light theme. Click a main group to see its categories and a category to see its
postings. A posting opens in Firefly III only when `firefly_link_url` is set; without it the posting is plain text. If
the rule group in `main_group_rule_group` does not exist, the page says so.

## Support

Report problems at <https://github.com/thomas3650/Ha-Spending/issues>.
