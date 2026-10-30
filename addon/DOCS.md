# HA Spending

The HA Spending add-on shows a household's spending from Firefly III on a page in Home Assistant. This first version
is a skeleton: the page only greets you and shows the add-on's version. Reading from Firefly III comes in a later
version.

## Installation

1. In Home Assistant go to *Settings → Apps → Install app → ⋮ → Repositories* and add
   `https://github.com/thomas3650/Ha-Spending`.
2. Install the *HA Spending* app and start it.
3. On the add-on's page turn on *Show in sidebar*. The page is then *Forbrug* in the sidebar. You can also open it with
   *Open web UI*.

## Configuration

The add-on has no options yet.

## Network

The page is reached through Home Assistant only (Ingress). The add-on publishes no port, and it refuses every request
that does not come through Home Assistant.

## The page

The page is in Danish and has a light theme.

## Support

Report problems at <https://github.com/thomas3650/Ha-Spending/issues>.
