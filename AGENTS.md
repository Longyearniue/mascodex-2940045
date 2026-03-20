# Agent Instructions

This project uses **bd** (beads) for issue tracking. Run `bd onboard` to get started.

## Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --status in_progress  # Claim work
bd close <id>         # Complete work
bd sync               # Sync with git
```

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds


---

## ⚠️ mascodex.com デプロイルール（必須）

### index.htmlを変更したら必ずやること
1. **git add + git commit** してからデプロイ
2. コミットなしにデプロイしない
3. `bash deploy-pages.sh` は必ず成功まで確認する

### デプロイ前に守られていること確認
- `What's Happening Now` セクション
- `Live Map` セクション（`social.mascodex.com/map`のiframe）
- JSの構文エラーなし

### deploy-pages.shには自動ガードが入っている
上記が欠けていると**デプロイが自動で止まる**。
エラーが出たら中断して原因を調査すること。

### よくある破壊パターン
- JS内でシングルクォートをテンプレートリテラル内に入れる → 構文エラー
- 未コミットの変更がある状態でデプロイ → 次回デプロイで消える
- deploy-pages.shを使わずに `wrangler pages deploy` を直接実行 → ガードをスキップ
