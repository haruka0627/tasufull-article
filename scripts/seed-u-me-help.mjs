console.log(`
u_me を Supabase に登録するには、Dashboard → SQL Editor で以下を実行してください:

  supabase/seed_u_me_rank_test.sql

確認 URL:
  detail-skill.html?userId=u_me&id=skill_test_001

ランク切替（ローカルでプレビューバー表示）:
  &rank=new | bronze | silver | gold | platinum | legend

※ member が null のときは supabase/members_profiles_rls_dev.sql も実行（RLS で空配列になるため）
※ anon キーでは RLS のため REST からの insert はできません。
`);
