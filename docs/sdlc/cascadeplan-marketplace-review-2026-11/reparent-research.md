# Re-parenting and issue type conversion through Jira Cloud REST v3 (Forge, asUser)

Fetch date: 2026-11-05. OpenAPI file fetched: https://developer.atlassian.com/cloud/jira/platform/swagger-v3.v3.json (info.version `1001.0.0-SNAPSHOT-fb5206f4949aae5c09b83f7aef3c5a1381f67e25`).

## Summary

The edit endpoint (`PUT /rest/api/3/issue/{issueIdOrKey}`) documents that "The parent field may be set by key or ID", and Atlassian's deprecation notice says to use `fields.parent` for "issues of all types" in both company-managed and team-managed projects. So setting or changing the parent of a standard issue to an Epic with `fields.parent` is documented, and the old Epic Link field is not needed (it is deprecated in REST and retired in new JQL). Changing the parent of an existing sub-task with the edit endpoint is NOT explicitly documented: the OpenAPI text is generic, and the Jira Cloud user guide contradicts itself (one section says you can select a new parent for a sub-task, another says "Subtasks also can't be moved directly from one work item to another"). Converting between standard and sub-task types through the edit endpoint is not documented anywhere. The documented REST route for issue type changes is the bulk move API (`POST /rest/api/3/bulk/issues/move`): its mapping key includes a target parent that is "Only required when the destination issueType is a subtask", it returns a `taskId`, and progress is read from `GET /rest/api/3/bulk/queue/{taskId}`. Bulk move needs the user to hold the global "bulk change" permission plus Move and Create issue permissions, needs the `write:jira-work` scope, says "Connect apps cannot access this REST resource", and shows a Forge `requestJira` code sample, but no page explicitly states "available to Forge asUser". The user guide says a work item that has its own sub-tasks cannot be converted to a sub-task; the API docs do not say what happens in that case. Nothing official states that key, id, due date, links, worklogs or issue properties are kept on a same-project parent change or type conversion. The default hierarchy is Epic (1) / standard (0) / sub-task (-1), sub-tasks cannot have children, and only Premium and Enterprise can add levels above Epic.

Notes on method:
- All quotes are copied from the pages and the OpenAPI file as fetched on 2026-11-05. Typographic apostrophes were changed to ASCII apostrophes. Nothing else was changed.
- Atlassian user-guide pages now say "work item" and "space" where older pages said "issue" and "project".
- Two sources are on community.developer.atlassian.com. They are Atlassian's official "Jira Cloud Announcements" posts, linked from developer.atlassian.com. I mark them as such.
- No sign-in, no credentials, no email address, no POST. Fetch only.

---

## Question 1. Change the parent of an existing SUB-TASK with `PUT /rest/api/3/issue/{issueIdOrKey}` and `fields.parent`

Verdict: Partly. The edit endpoint documents setting `parent`, but no official text says it works for an existing sub-task. The user guide contradicts itself. Bulk move is documented to put a sub-task under a new parent.

### What the edit endpoint says

OpenAPI, `PUT /rest/api/3/issue/{issueIdOrKey}` (Edit issue), description:

> "The parent field may be set by key or ID. For standard issue types, the parent may be removed by setting `update.parent.set.none` to *true*."

> "The edits to the issue's fields are defined using `update` and `fields`. The fields that can be edited are determined using [ Get edit issue metadata](#api-rest-api-3-issue-issueIdOrKey-editmeta-get)."

> "**Note:** This endpoint doesn't check screen configurations to determine if a field is editable."

URL: https://developer.atlassian.com/cloud/jira/platform/swagger-v3.v3.json (also rendered at https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/#api-rest-api-3-issue-issueidorkey-put)

The sentence does not separate sub-tasks from standard issues. The second sentence limits parent removal to "standard issue types", which implies a sub-task's parent cannot be cleared with this endpoint. It does not say whether a sub-task's parent can be replaced.

### Permission (edit endpoint)

OpenAPI, Edit issue:

> "**[Permissions](#permissions) required:**
>  *  *Browse projects* and *Edit issues* [project permission](https://confluence.atlassian.com/x/yodKLg) for the project that the issue is in.
>  *  If [issue-level security](https://confluence.atlassian.com/x/J4lKLg) is configured, issue-level security permission to view the issue."

OAuth scope in the OpenAPI `security` block: `write:jira-work` (classic, state "Current"); granular `write:issue:jira` (state "Beta").

### What the Jira Cloud user guide says (contradictory)

"Create a work item and a subtask", section "Change the parent work item of a child work item":

> "Open the child work item or subtask."
> "Select the work type icon in the top-left corner next to the key of the parent work item."
> "Select a new parent work item for your child work item or subtask."
> "In the timeline and list views, you can also change the parent work item of a work item by dragging and dropping it underneath a new parent work item."

Same page, section "Convert a work item to a subtask":

> "Subtasks also can't be moved directly from one work item to another. Convert them to standalone work items first, then to subtasks of their new parent work item."

URL: https://support.atlassian.com/jira-software-cloud/docs/create-a-work-item-and-a-subtask/

The two sections conflict. The first says the UI can pick a new parent for a sub-task. The second says it cannot. Neither section talks about REST.

### Indirect evidence that sub-task re-parenting exists as an operation

Developer deprecation notice on changelogs:

> "IssueParentAssociation will be the new source of truth in the issue history changelogs for information about issue reparenting, that is, changing epic links and subtask parents."

URL: https://developer.atlassian.com/cloud/jira/platform/deprecation-notice-issue-reparenting-changelogs/

### Bulk move puts a sub-task under a new parent (documented)

"Bulk operation APIs: additional examples and FAQ":

> "This payload for bulk move attempts to move a subtask explicitly, meaning the subtask has its own mapping and is not moved as part of its parent issue."
> "The subtask MTCJS-2 will be moved to a project MTCJ with issue type ID as 10008 under a new parent i.e, MTCJ-11."

The payload key in that example is `"MTCJ,10008,MTCJ-11"` (project, sub-task issue type, new parent).

URL: https://developer.atlassian.com/cloud/jira/platform/bulk-operation-additional-examples-and-faqs/

This example moves the sub-task to a different project. A same-project re-parent with bulk move is not shown, but the key format allows it (see Question 2).

### Known restrictions found

- Parent and sub-task must be in the same project when creating. OpenAPI, `POST /rest/api/3/issue/bulk`, 201 response text lists failures such as: "is to create a subtype in a project different that of the parent issue." (create only; nothing equivalent is written for edit).
- Team-managed: "You can create subtasks under any standard work items, like stories, bugs, or tasks. Unlike in company-managed spaces, subtasks can't be nested directly beneath work items at the Epic level." URL: https://support.atlassian.com/jira-software-cloud/docs/manage-subtasks-in-team-managed-projects/
- Company-managed: "In most cases, child work items can only be created and nested under standalone work items. In company-managed software spaces, you can assign subtasks directly to the work type your space uses for larger pieces of work (by default, this is called an epic) using the Add parent link on the work item." URL: https://support.atlassian.com/jira-software-cloud/docs/create-a-work-item-and-a-subtask/
- Team-managed create rule (OpenAPI, `POST /rest/api/3/issue`): "In a next-gen project any issue may be made a child providing that the parent and child are members of the same project."

Company-managed vs team-managed for sub-task re-parent via edit: Not documented.

---

## Question 2. Convert a STANDARD issue (level 0) to a SUB-TASK through REST

Verdict:
- Edit endpoint (issuetype + parent): Not documented.
- Bulk move with target parent: Partly (the key format and parameter text support it; no scenario names "standard to sub-task" explicitly).
- Asynchronous with task id and polling: Confirmed (by response shape and the progress endpoint; the move text itself does not use the word "asynchronous").
- Permissions and scopes: Confirmed.
- Forge with asUser: Partly (Forge sample shown, Connect excluded, no explicit Forge statement).
- What happens to the issue's own sub-tasks: Partly (UI guide forbids it; API behavior not documented).

### Edit endpoint

The OpenAPI Edit issue text (quoted in Question 1) does not mention changing `issuetype` at all, and does not mention converting between standard and sub-task types. The related user-guide text for the UI is:

> "If there are different fields in the new work type, or if it has a different workflow, we'll open the move work item screen to complete the change."

URL: https://support.atlassian.com/jira-software-cloud/docs/create-a-work-item-and-a-subtask/ (section "Change a work type")

Edit endpoint conversion standard to sub-task: Not documented.

### Bulk move API: what it is

OpenAPI, `POST /rest/api/3/bulk/issues/move` (Bulk move issues):

> "Use this API to submit a bulk issue move request. You can move multiple issues from multiple projects in a single request, but they must all be moved to a single project, issue type, and parent. You can't move more than 1000 issues (including subtasks) at once."

> "This is an early version of the API and it doesn't have full feature parity with the Bulk Move UI experience."

> " *  Moving issue of type A to issue of type B in the same project or a different project: `SUPPORTED`"

> " *  Moving a standard parent issue of type A with its multiple subtask issue types in one project to standard issue of type B and multiple subtask issue types in the same project or a different project: `SUPPORTED`"

> " *  Moving standard issues with their subtasks to a parent issue in the same project or a different project without losing their relation: `SUPPORTED`"

URL: https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-bulk-operations/#api-rest-api-3-bulk-issues-move-post

### Bulk move: target parent and `targetToSourcesMapping`

OpenAPI schema `IssueBulkMovePayload.targetToSourcesMapping`:

> "The key is a string that is created by concatenating the following three entities in order, separated by commas. The format is `<project ID or key>,<issueType ID>,<parent ID or key>`. It should be unique across mappings provided in the payload. If you provide multiple mappings for the same key, only one will be processed. However, the operation won't fail, so the error may be hard to track down."

> " *  ***Destination project*** (Required): ID or key of the project to which the issues are being moved.
>  *  ***Destination issueType*** (Required): ID of the issueType to which the issues are being moved.
>  *  ***Destination parent ID or key*** (Optional): ID or key of the issue which will become the parent of the issues being moved. Only required when the destination issueType is a subtask."

This is the closest documented route for "standard issue becomes sub-task of X": key `PROJ,<subtaskTypeId>,X`. No scenario line says "standard to sub-task" in so many words.

The other required booleans per mapping (OpenAPI schema `targetToSourcesMapping`, all marked required): `inferClassificationDefaults`, `inferFieldDefaults`, `inferStatusDefaults`, `inferSubtaskTypeDefault`. Example for `inferStatusDefaults`:

> "If `true`, the statuses of issues being moved in this target group that are not present in the target workflow will be changed to the default status of the target workflow (see below). Leave `targetStatus` empty when using this."

### `inferSubtaskTypeDefault`

OpenAPI schema `targetToSourcesMapping.inferSubtaskTypeDefault`:

> "When an issue is moved, its subtasks (if there are any) need to be moved with it. `inferSubtaskTypeDefault` helps with moving the subtasks by picking a random subtask type in the target project."

> "If `true`, subtasks will automatically move to the same project as their parent."

> "When they move:
>  *  Their `issueType` will be set to the default for subtasks in the target project.
>  *  Values for mandatory fields will be retained from the source issues
>  *  Specifying separate mapping for implicit subtasks won't be allowed."

> "If `false`, you must manually move the subtasks. They will retain the parent which they had in the current project after being moved."

FAQ:

> "If a subtask lacks pre-filled mandatory fields and inferSubtaskTypeDefault is set to true, the system requires explicit mapping for these fields. You need to set inferSubtaskTypeDefault to false and provide the necessary field mappings for subtasks."

URL: https://developer.atlassian.com/cloud/jira/platform/bulk-operation-additional-examples-and-faqs/

### Asynchronous: task id and polling

OpenAPI, Bulk move issues, response 201: "Returned if the request is successful." Example body: `{"taskId":"10641"}` (schema `SubmittedBulkOperation` with one property `taskId`).

OpenAPI, `GET /rest/api/3/bulk/queue/{taskId}` (Get bulk issue operation progress):

> "Use this to get the progress state for the specified bulk operation `taskId`."

> "If the task is running, this resource will return:
>     {"taskId":"10779","status":"RUNNING","progressPercent":65, ...}"

> "If the task has completed, then this resource will return:
>     {"processedAccessibleIssues":[10001,10002], ... "status":"COMPLETE", ... "invalidOrInaccessibleIssueCount":0, ...}"

> "**Note:** You can view task progress for up to 14 days from creation."

Schema `BulkOperationProgress.status` enum: `ENQUEUED`, `RUNNING`, `COMPLETE`, `FAILED`, `CANCEL_REQUESTED`, `CANCELLED`, `DEAD`. Property `failedAccessibleIssues`: "Map of issue IDs for which the operation failed and that the user has permission to view, to their one or more reasons for failure. These reasons are open-ended text descriptions of the error and are not selected from a predefined list of standard reasons."

URL: https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-bulk-operations/#api-rest-api-3-bulk-queue-taskid-get

Rate limit, tag description "Issue bulk operations":

> "The bulk edit and move APIs are subject to the usual rate limiting infrastructure in Jira. For more information, refer to Rate limiting. Additionally, at any given time, only 5 concurrent requests can be sent across all users."

### Permissions and OAuth scopes

Bulk move issues (OpenAPI):

> "**[Permissions](#permissions) required:**
>  *  Global bulk change [permission](https://support.atlassian.com/jira-cloud-administration/docs/manage-global-permissions/).
>  *  Move [issues permission](...) in source projects.
>  *  Create [issues permission](...) in destination projects.
>  *  Browse [project permission](...) in destination projects, if moving subtasks only.
>  *  If [issue-level security](https://confluence.atlassian.com/x/J4lKLg) is configured, issue-level security permission to view the issue."

Rendered page, Bulk move issues:

> "OAuth 2.0 scopes required:"
> "ClassicRECOMMENDED:write:jira-work"
> "Granular:write:issue:jira, read:issue:jira"
> "Connect apps cannot access this REST resource."
> "Data Security Policy: Exempt from app access rules"

Get bulk issue operation progress (OpenAPI): permission "Global bulk change [permission]"; scope `read:jira-work` (classic), `read:issue:jira` (granular, "Beta").

The user guide names the global permission "Make bulk changes":

> "To bulk move work items, you must have the Make bulk changes global permission."

URL: https://support.atlassian.com/jira-software-cloud/docs/edit-multiple-issues-at-the-same-time/

Because the call runs as the user (`asUser`), these are the end user's permissions. A user without "Make bulk changes" cannot use bulk move. This is an inference from the permission list, not a separate statement.

### Forge with asUser

- The rendered bulk operations page shows, for each operation, a "Forge" code tab with: `// This sample uses Atlassian Forge` and `import { requestJira } from "@forge/bridge";` URL: https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-bulk-operations/
- It also says "Connect apps cannot access this REST resource." (OpenAPI `x-atlassian-connect-scope: INACCESSIBLE`). This excludes Connect, not Forge.
- Forge manifest reference: "Atlassian app scopes enable a Forge app to request a level of access to an Atlassian app. You can find details about each Atlassian app operation's required scopes through the REST API documentation (specifically, in the operation's Oauth scopes required field)." URL: https://developer.atlassian.com/platform/forge/manifest-reference/permissions/
- Forge `requestJira` reference: "api.asUser() Use this method to call an Atlassian API as the user of the app. If the user initiating the request has not granted permission to the app, the request is made without a valid Authorization header." URL: https://developer.atlassian.com/platform/forge/apis-reference/fetch-api-product.requestjira/
- Jira scopes page: "write:jira-work Create and manage issues Create and edit issues in Jira, post comments as the user, create worklogs, and delete issues." URL: https://developer.atlassian.com/cloud/jira/platform/scopes-for-oauth-2-3LO-and-forge-apps/

An explicit sentence "bulk move is available to Forge apps with asUser" was not found. The scopes match what the app already has (`write:jira-work` for the move, `read:jira-work` for polling).

### What happens to the issue's own sub-tasks

User guide, "Convert a work item to a subtask":

> "You can't convert a work item to a subtask if the work item has subtasks of its own. First, convert the work item's subtasks to standalone work items, then you convert them to subtasks of another work item."

URL: https://support.atlassian.com/jira-software-cloud/docs/create-a-work-item-and-a-subtask/

Default hierarchy rule: "A subtask can't have any child work items." URL: https://support.atlassian.com/jira-cloud-administration/docs/what-are-issue-types/

What the bulk move API does (error, auto-detach, or move) when the source issue has sub-tasks and the target type is a sub-task: Not documented. The `inferSubtaskTypeDefault` text describes moving sub-tasks together with a parent that stays a parent; it does not cover this case.

### Bulk edit cannot set parent (side finding)

The OpenAPI `JiraIssueFields` schema for `POST /rest/api/3/bulk/issues/fields` has `issueType` ("Set the issue type field by providing an `issueTypeId`.") but no `parent` property. The bulk move text says "(Alternatively, move them individually and stitch the relationship back with the Bulk Edit API)", which does not match the schema I fetched. Not resolved by the docs.

---

## Question 3. Convert a SUB-TASK to a standard issue through REST

Verdict: Partly. Edit endpoint: Not documented (and the edit text limits parent removal to standard types). Bulk move: covered by the generic "type A to type B" scenario, not by a named sub-task scenario.

Edit endpoint (OpenAPI):

> "For standard issue types, the parent may be removed by setting `update.parent.set.none` to *true*."

This wording limits parent removal to standard types. Changing `issuetype` of a sub-task to a standard type through edit: Not documented.

Bulk move (OpenAPI):

> " *  Moving issue of type A to issue of type B in the same project or a different project: `SUPPORTED`"

and the mapping key's parent part is "Optional ... Only required when the destination issueType is a subtask", so a key `PROJ,<standardTypeId>` (no parent) is the documented shape for a standard target.

User guide (UI only):

Company-managed: "Select More actions (...), then Convert to work item." ... "The new work item will be displayed, without a parent work item linked at the top of the screen."
Team-managed: "In a team-managed space, the process is slightly different:" "From the subtask you want to convert, select More actions (...), then Move."

URL: https://support.atlassian.com/jira-software-cloud/docs/create-a-work-item-and-a-subtask/ (the page shows a bullet glyph inside "More actions"; written here as "(...)")

The team-managed UI path is the Move flow, which matches the bulk move API family. That link between UI and API is an inference.

---

## Question 4. Set or change the parent of a standard issue to an Epic with `fields.parent`

Verdict: Confirmed for both company-managed and team-managed. Epic Link is not needed for REST writes.

Atlassian announcement "Deprecation of the Epic Link, Parent Link and other related fields in REST APIs and webhooks" (Jira Cloud Announcements, posted 2021-11-30), Change 2, endpoints include `PUT /rest/api/3/issue/{issueIdOrKey}`:

> "Deprecated behavior: For issues in company-managed projects, stop providing the Epic Link and Parent Link fields."

> "New behavior: For issues in both company-managed and team-managed projects, provide the parent field (where applicable) for issues of all types. Example of usage of the parent field: "fields": { ... "parent": { "id": "10055" } ... }"

> "Atlassian is standardizing how we associate parent and child issues across Jira for company-managed and team-managed projects. This results in deprecation of the Epic Link and Parent Link custom fields in REST APIs and webhooks, as well as in some other related changes."

URL: https://community.developer.atlassian.com/t/deprecation-of-the-epic-link-parent-link-and-other-related-fields-in-rest-apis-and-webhooks/54048 (official Atlassian announcement channel)

The announcement says the deprecation period ran from 30 November 2021 to 30 November 2022, after which "the old behavior may be switched off" (paraphrase of the post's dates section).

Edit endpoint (OpenAPI): "The parent field may be set by key or ID." Removing the epic: "For standard issue types, the parent may be removed by setting `update.parent.set.none` to *true*."

Admin field types page: "Parent replaced both Parent link and Epic link fields". URL: https://support.atlassian.com/jira-cloud-administration/docs/field-types-you-can-create-as-a-jira-admin/

CSV KB: "Going forward, the Parent field should be used in place of Epic Link in Jira Cloud." URL: https://support.atlassian.com/jira/kb/keep-issue-parent-child-mapping-during-csv-import-to-jira-cloud/

Is Epic Link still needed anywhere?

- JQL: "As of February 2024, Epic link function has been retired in favor of Parent. Existing filters that use the Epic link function still function, but you'll need to use Parent when creating new filters." URL: https://support.atlassian.com/jira-service-management-cloud/docs/jql-fields/
- Changelogs: "We're deprecating the Epic Link and Parent values returned in field in issue history changelogs for company-managed projects (previously known as classic projects). These values will be replaced with IssueParentAssociation, a value used in team-managed projects (previously known as next gen projects)." and "We will ceased to return issue history changelog items containing the Epic Link and Parent values on 10 December 2021." URL: https://developer.atlassian.com/cloud/jira/platform/deprecation-notice-issue-reparenting-changelogs/

So: no REST write needs Epic Link. An app that reads history should read `IssueParentAssociation`.

Plan restriction on epic-level parents (Standard plan with a leftover custom hierarchy):

> "You need to have Premium subscription to set parent to a work item of this type."
> "Under a default hierarchy, Epics are the only work type at the top of the hierarchy. The issue occurs when, in a Standard plan, another work type is at the same level as Epic."

URL: https://support.atlassian.com/jira/kb/need-premium-subscription-to-set-parent-error-in-jira-cloud/

---

## Question 5. Are key, id, due date, links, worklogs and issue properties kept?

Verdict: Not documented for a same-project parent change or type conversion. Partly documented for cross-project moves (key changes, links redirect).

- Edit endpoint: edits the existing issue identified by `issueIdOrKey`; response 204 "Returned if the request is successful." No sentence about id or key being kept or changed. Not documented.
- Bulk move, same project: no sentence about key, id, due date, links, worklogs or issue properties. Not documented.
- Bulk move field retention, `inferFieldDefaults`: "If `true`, values from the source issues will be retained for the mandatory fields in the field configuration of the destination project." (OpenAPI). This only covers mandatory fields.
- User guide, bulk move: "If work types use different workflows, you may lose data when bulk moving work items." and "For each field listed, update the value that should appear on the work items you're moving, or select Retain to leave the field's value unchanged." URL: https://support.atlassian.com/jira-software-cloud/docs/edit-multiple-issues-at-the-same-time/
- Cross-project only (migration guide): "Space and work item keys: Jira will automatically update the work item keys of migrated work items to reflect their new space. Any existing links to old work item keys will be automatically redirected." URL: https://support.atlassian.com/jira-software-cloud/docs/migrate-between-team-managed-and-company-managed-projects/
- Bulk move keeps the parent relation: "Moving standard issues with their subtasks to a parent issue in the same project or a different project without losing their relation: `SUPPORTED`" (OpenAPI).

Due date, issue links, worklogs, issue properties on type conversion or re-parent: Not documented.

---

## Question 6. Hierarchy depth limits (Standard vs Premium)

Verdict: Confirmed.

Default levels (Configure the work type hierarchy):

> "By default, Jira is set up with three levels of work type hierarchy: a level for larger pieces of work (level 1, by default called Epic), a level for standard work items (level 0, called Story), and a level for smaller pieces of work (level -1, called Subtask)."

> "Changes to your work type hierarchy will apply to all company-managed spaces in your site."

> "Jira Premium and Enterprise customers can also create and manage additional levels in their work type hierarchy."

> "Add work types to the level for larger pieces of work" ... "This is only available as part of Jira Cloud Premium and Enterprise."

> "Changing your work type hierarchy will break existing parent and child relationships between your work items."

URL: https://support.atlassian.com/jira-cloud-administration/docs/configure-the-issue-type-hierarchy/

Sub-tasks are one level only (What are work types?):

> "any work type can be both a parent and a child work item - the only exception being subtasks, which can only be a child since there aren't any work types below it in the hierarchy."

(The page uses a dash character there; written here as an ASCII hyphen.)

> "A subtask can't have any child work items."

URL: https://support.atlassian.com/jira-cloud-administration/docs/what-are-issue-types/

Levels above Epic in plans:

> "By default, Jira comes with Epic as a level 1 work type, and Story as a level 0 (subtasks are considered -1 or below Story). While you can rename Epic, which remains at level 1, as part of your Jira Premium and Enterprise subscriptions, you can also add levels above 1 and use these extra levels to track your organization's larger initiatives in your company-managed projects and plans to unify work across multiple spaces."

URL: https://support.atlassian.com/jira-software-cloud/docs/configure-custom-hierarchy-levels-in-advanced-roadmaps/

Standard plan: custom hierarchy cannot be used (KB): "Now that the site has a Standard subscription, it has lost the ability to configure and use custom hierarchies, but the custom hierarchy was preserved as it was since the Premium subscription, even though it can't be used as such." URL: https://support.atlassian.com/jira/kb/need-premium-subscription-to-set-parent-error-in-jira-cloud/

Team-managed: sub-tasks sit under standard items only: "Unlike in company-managed spaces, subtasks can't be nested directly beneath work items at the Epic level." URL: https://support.atlassian.com/jira-software-cloud/docs/manage-subtasks-in-team-managed-projects/

Levels above Epic inside team-managed projects: Not documented on the pages fetched (the hierarchy settings page scopes itself to company-managed spaces).

For an app, the OpenAPI exposes levels per issue type: `IssueTypeCreateBean.hierarchyLevel` "Use: `-1` for Subtask. `0` for Base." and `IssueTypeHierarchyPayload.hierarchyLevel` "0, 1, 2, 3 .. n; Negative values for subtasks".

---

## Sources fetched

- https://developer.atlassian.com/cloud/jira/platform/swagger-v3.v3.json
- https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-bulk-operations/
- https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/
- https://developer.atlassian.com/cloud/jira/platform/bulk-operation-additional-examples-and-faqs/
- https://developer.atlassian.com/cloud/jira/platform/deprecation-notice-issue-reparenting-changelogs/
- https://developer.atlassian.com/cloud/jira/platform/scopes-for-oauth-2-3LO-and-forge-apps/
- https://developer.atlassian.com/platform/forge/apis-reference/fetch-api-product.requestjira/
- https://developer.atlassian.com/platform/forge/manifest-reference/permissions/
- https://community.developer.atlassian.com/t/deprecation-of-the-epic-link-parent-link-and-other-related-fields-in-rest-apis-and-webhooks/54048 (official announcement)
- https://support.atlassian.com/jira-software-cloud/docs/create-a-work-item-and-a-subtask/
- https://support.atlassian.com/jira-software-cloud/docs/manage-subtasks-in-team-managed-projects/
- https://support.atlassian.com/jira-software-cloud/docs/edit-multiple-issues-at-the-same-time/
- https://support.atlassian.com/jira-software-cloud/docs/migrate-between-team-managed-and-company-managed-projects/
- https://support.atlassian.com/jira-software-cloud/docs/configure-custom-hierarchy-levels-in-advanced-roadmaps/
- https://support.atlassian.com/jira-cloud-administration/docs/configure-the-issue-type-hierarchy/
- https://support.atlassian.com/jira-cloud-administration/docs/what-are-issue-types/
- https://support.atlassian.com/jira-cloud-administration/docs/field-types-you-can-create-as-a-jira-admin/
- https://support.atlassian.com/jira-service-management-cloud/docs/jql-fields/
- https://support.atlassian.com/jira/kb/need-premium-subscription-to-set-parent-error-in-jira-cloud/
- https://support.atlassian.com/jira/kb/keep-issue-parent-child-mapping-during-csv-import-to-jira-cloud/
- https://support.atlassian.com/atlassian-cloud/kb/bulk-move-work-items-with-the-jira-cloud-rest-api/ (read; repeats the OpenAPI scenarios; adds "The API does not recursively include a parent's child work items.")
