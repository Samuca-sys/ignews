import { query as q } from 'faunadb'

import NextAuth from 'next-auth'
import Providers from 'next-auth/providers'

import { fauna } from '../../../services/fauna'

export default NextAuth({
  providers: [
    Providers.GitHub({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      scope: 'read:user'
    }),
  ],

  callbacks: {
    async session(session) {
      try {
        const userActiveSubscription = fauna.query(
          q.Get(
            q.Intersection([
              q.Match(
                q.Index('subscription_by_user_ref'),
                q.Select(
                  "ref",
                  q.Get(
                    q.Match(
                      q.Index('user_by_email'),
                      q.Casefold(session.user.email)
                    )
                  )
                )
              ),
              q.Match(
                q.Index('subscription_by_status'),
                "active"
              )
            ])
          )
        )
        console.log('TRY: ', session)
        return {
          ...session,
          activeSubscription: userActiveSubscription
        }
      } catch {
        console.log('CATCH: ', session)
        return {
          ...session,
          activeSubscription: null
        }
      }

    },
    async signIn(user) {
      const { email } = user

      try {
        await fauna.query(
          //IF (!(SELECT user_id FROM users 
          //  WHERE user_id = LOWERCASE(user_by_email)))
          //-------------------------------------------------
          //      INSERT INTO users (user_id) VALUES (user_by_email) 
          //-------------------------------------------------
          // ELSE IF(SELECT user_id FROM users 
          //  WHERE user_id = LOWERCASE(user_by_email))
          //-------------------------------------------------
          //      (SELECT user_email user_id FROM users 
          //          WHERE user_id = LOWERCASE(user_by_email))
          q.If(
            q.Not(
              q.Exists(
                q.Match(
                  q.Index('user_by_email'),
                  q.Casefold(user.email)
                )
              )
            ),
            q.Create(
              q.Collection('users'),
              { data: { email } }
            ),
            q.Get(
              q.Match(
                q.Index('user_by_email'),
                q.Casefold(user.email)
              )
            )
          )
        )

        return true
      }
      catch {
        return false
      }
    }
  }
})