import { CursorGlow } from '@/components/home/CursorGlow'
import { HeroSection } from '@/components/home/HeroSection'
import { FeatureCards } from '@/components/home/FeatureCards'
import { HowItWorks } from '@/components/home/HowItWorks'
import { Showcase } from '@/components/home/Showcase'
import { CTASection } from '@/components/home/CTASection'
import { HomeFooter } from '@/components/home/HomeFooter'

export default function HomePage() {
  return (
    <div className="bg-[#0a0a0b]">
      <CursorGlow />
      <HeroSection />
      <FeatureCards />
      <HowItWorks />
      <Showcase />
      <CTASection />
      <HomeFooter />
    </div>
  )
}
