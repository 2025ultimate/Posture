import { memo } from "react";
// Education for someone who just found out they have anterior pelvic tilt
// and sits all day. Written to be practical and to push back on the two
// classic traps: obsessing over a normal amount of tilt, and expecting a
// gadget to fix what only consistent training fixes.

function LearnViewInner() {
  return (
    <div className="view learn-view">
      <div className="view-head">
        <h1 className="view-title">Understanding anterior pelvic tilt</h1>
        <p className="view-sub">
          Five minutes of context that makes the daily work make sense.
        </p>
      </div>

      <div className="learn-card">
        <h3 className="learn-title">What it is</h3>
        <p>
          Anterior pelvic tilt (APT) means your pelvis is rotated forward:
          picture a bowl of water tipping so it spills toward your toes. The
          visible signature is an exaggerated lower-back arch, the belly
          pushed forward and the glutes pushed back — even at a normal body
          weight.
        </p>
        <p>
          Important context: <strong>some anterior tilt is normal anatomy.</strong>{" "}
          Studies of pain-free adults commonly measure around 6–7° of anterior
          tilt in men and 7–10° in women. APT becomes worth working on when
          the tilt is pronounced, when you can't move out of it, or when it
          comes with low-back tightness, hip pinching, or a back that fatigues
          from standing.
        </p>
      </div>

      <div className="learn-card">
        <h3 className="learn-title">Why a sitting job feeds it</h3>
        <p>
          Sitting parks your hip flexors — the muscles crossing the front of
          the hip — in a shortened position for hours, while your glutes
          spend the day switched off with nothing to do. Tissue adapts to the
          position you keep it in. Over months the front of the hip gets
          stubbornly tight, the backside gets weak, and when you stand up the
          tight front tips the pelvis forward because the weak back can't
          hold it level.
        </p>
        <p>
          Clinicians call this pattern <strong>lower crossed syndrome</strong>:
          tight hip flexors and lower-back muscles crossing with weak glutes
          and abdominals.
        </p>
      </div>

      <div className="learn-card">
        <h3 className="learn-title">What actually fixes it</h3>
        <p>There's no shortcut, but the recipe is simple and it works:</p>
        <ul className="learn-list">
          <li>
            <strong>Stretch the tight side</strong> — hip flexors and quads
            daily, with a pelvic tuck so the stretch hits the hip and not the
            low back.
          </li>
          <li>
            <strong>Strengthen the weak side</strong> — glutes (bridges, hip
            thrusts), abdominals (dead bugs, planks with a tuck) and
            hamstrings, which pull the pelvis toward neutral from below.
          </li>
          <li>
            <strong>Re-learn neutral</strong> — pelvic tilt drills teach your
            nervous system where level actually is, so the new strength gets
            used.
          </li>
          <li>
            <strong>Break up sitting</strong> — stand and move every 30–45
            minutes so the hip flexors stop re-shortening between workouts.
          </li>
        </ul>
        <p>
          Expect visible change in <strong>8–12 weeks</strong> of near-daily
          10–15 minute sessions. That's the entire design of this app: the
          Today routine covers the first three points, the Desk tab covers the
          fourth, and the Check tab proves the change is happening.
        </p>
      </div>

      <div className="learn-card">
        <h3 className="learn-title">What the cameras can and can't see</h3>
        <p>
          Straight talk, because you should know what your tools measure:
        </p>
        <ul className="learn-list">
          <li>
            The <strong>phone side-view check</strong> estimates alignment from
            pose landmarks — hips over ankles, ribcage over pelvis, head over
            shoulders. Those are honest proxies for the APT pattern, but not a
            clinical pelvic-tilt angle (that needs bony landmarks no camera
            model tracks). Use it to compare you-now against you-last-month.
          </li>
          <li>
            The <strong>desk webcam</strong> sees your upper body from the
            front — it can never see your pelvis behind a desk. Its real jobs
            are neck/shoulder posture and knowing when you're seated so the
            break coach can do the part that matters for APT.
          </li>
          <li>
            The <strong>wall test and Thomas test</strong> on the Check tab are
            the standard at-home ways to gauge the pelvis and hip flexors
            directly. Low-tech beats high-tech here — log them monthly.
          </li>
        </ul>
      </div>

      <div className="learn-card">
        <h3 className="learn-title">When to see a professional</h3>
        <ul className="learn-list">
          <li>Pain that radiates down a leg, or numbness / tingling anywhere.</li>
          <li>Night pain, or back pain after any trauma.</li>
          <li>Sharp joint pain during any exercise (muscle burn is fine, sting is not).</li>
          <li>No change at all after 8–12 weeks of consistent work.</li>
          <li>You're unsure APT is even your pattern — a physio can confirm in one visit.</li>
        </ul>
      </div>

      <div className="learn-disclaimer">
        <strong>Not medical advice.</strong> PostureGuard is an educational and
        habit tool, not a diagnosis or treatment. It can't examine you, and
        posture estimates from cameras have real limits. If you have pain or
        any symptom listed above, see a qualified clinician — and if a
        professional's guidance ever conflicts with this app, follow the
        professional.
      </div>
    </div>
  );
}

// Memoized: the app root re-renders ~10×/s while desk monitoring runs.
export const LearnView = memo(LearnViewInner);
