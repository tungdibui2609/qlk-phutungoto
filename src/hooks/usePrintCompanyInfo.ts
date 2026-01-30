'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'

export interface CompanyInfo {
    name: string
    short_name: string | null
    address: string | null
    phone: string | null
    email: string | null
    tax_code: string | null
    logo_url: string | null
}

interface UsePrintCompanyInfoOptions {
    /** Auth token from URL params (for screenshot service) */
    token?: string | null
    /** company_id from the order being printed (takes priority) */
    orderCompanyId?: string | null
    /** Initial company info passed via URL params (for screenshot service) */
    initialCompanyInfo?: CompanyInfo | null
    /** 
     * If true, fetches company info from user profile if orderCompanyId is missing.
     * Useful for reports (Inventory) that are not tied to a specific order.
     * Default: true 
     */
    fallbackToProfile?: boolean
}

export function usePrintCompanyInfo(options: UsePrintCompanyInfoOptions = {}) {
    const {
        token,
        orderCompanyId,
        initialCompanyInfo,
        fallbackToProfile = true
    } = options

    const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(initialCompanyInfo || null)
    const [logoSrc, setLogoSrc] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchCompanyInfo()

        // Subscribe to auth changes to retry fetching if session is restored late
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
                fetchCompanyInfo()
            }
        })

        return () => {
            subscription.unsubscribe()
        }
    }, [orderCompanyId])

    async function fetchCompanyInfo() {
        setLoading(true)
        try {
            let companyData: any = null

            // Priority 1: Use company_id from the order
            if (orderCompanyId) {
                const { data } = await supabase
                    .from('company_settings')
                    .select('*')
                    .eq('id', orderCompanyId)
                    .single()
                companyData = data
            }

            // Priority 2: Get company_id from user's profile
            if (!companyData && fallbackToProfile) {
                // Determine source: passed token or current session
                if (token) {
                    await supabase.auth.setSession({ access_token: token, refresh_token: '' })
                }

                const { data: profileData, error: profileError } = await supabase
                    .from('user_profiles')
                    .select('company_id')
                    .maybeSingle()

                if (profileError) {
                    // Use warn instead of error to avoid blocking Next.js dev overlay
                    console.warn('Warning fetching user profile:', profileError)
                }

                if (!profileData) {
                    console.warn('No profile data found for current user.')
                }

                if ((profileData as any)?.company_id) {
                    const { data } = await supabase
                        .from('company_settings')
                        .select('*')
                        .eq('id', (profileData as any).company_id)
                        .single()
                    companyData = data
                }
            }

            if (companyData) {
                setCompanyInfo(companyData as CompanyInfo)

                // Handle secure logo loading
                if (companyData.logo_url) {
                    const url = companyData.logo_url
                    if (token && url.includes('supabase')) {
                        try {
                            const res = await fetch(url, {
                                headers: { Authorization: `Bearer ${token}` }
                            })
                            if (res.ok) {
                                const blob = await res.blob()
                                setLogoSrc(URL.createObjectURL(blob))
                            } else {
                                setLogoSrc(url)
                            }
                        } catch (e) {
                            setLogoSrc(url)
                        }
                    } else {
                        setLogoSrc(url)
                    }
                }
            } else if (initialCompanyInfo?.logo_url) {
                // Fallback to params info if fetch fails or no data
                setLogoSrc(initialCompanyInfo.logo_url)
            }
        } catch (error) {
            console.error('Error fetching company info:', error)
            // Keep existing companyInfo if valid (don't overwrite with null on error if not necessary)
        } finally {
            setLoading(false)
        }
    }

    return {
        companyInfo,
        logoSrc,
        loading,
        refetch: fetchCompanyInfo
    }
}
