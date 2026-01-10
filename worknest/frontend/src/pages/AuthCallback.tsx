import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/store';

export function AuthCallback() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { fetchUser } = useAuthStore();

    useEffect(() => {
        const token = searchParams.get('token');
        const subdomain = searchParams.get('subdomain');

        if (token) {
            localStorage.setItem('token', token);
            if (subdomain) {
                localStorage.setItem('subdomain', subdomain);
            }

            // Fetch user data with the new token
            fetchUser().then(() => {
                navigate('/chat');
            }).catch(() => {
                navigate('/login');
            });
        } else {
            navigate('/login');
        }
    }, [searchParams, navigate, fetchUser]);

    return (
        <div className="h-screen flex items-center justify-center bg-background">
            <div className="text-center space-y-4">
                <div className="animate-spin h-8 w-8 mx-auto border-2 border-primary border-t-transparent rounded-full" />
                <p className="text-muted-foreground">Redirecting you to your workspace...</p>
            </div>
        </div>
    );
}

export default AuthCallback;
