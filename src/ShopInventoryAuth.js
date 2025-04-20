// src\ShopInventoryAuth.js
import React, { useState, useEffect } from 'react';
import { LogOut, PlusCircle, Search, Grid3X3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Alert, AlertDescription } from './components/ui/alert';
import { auth, db, googleProvider } from './firebase';
import { 
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged 
} from 'firebase/auth';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';

const ShopInventoryAuth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Authentication state
  const [user, setUser] = useState(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // Check if user is in allowlist  
  const checkUserAuthorization = async (email) => {
    try {
      const allowedUsersRef = collection(db, 'allowedUsers');
      const q = query(allowedUsersRef, where('email', '==', email));
      const querySnapshot = await getDocs(q);
      return !querySnapshot.empty;
    } catch (error) {
      console.error("Error checking authorization:", error);
      return false;
    }
  };

  // Handle unauthorized access
  const handleUnauthorizedAccess = async (email, method) => {
    try {
      await addDoc(collection(db, 'unauthorizedAttempts'), {
        email,
        timestamp: new Date(),
        method,
        userAgent: navigator.userAgent,
      });
      
      // Sign out the unauthorized user
      await signOut(auth);
      setLoginError('Access denied. Unauthorized user.');
      setUser(null);
      setIsAuthorized(false);
    } catch (error) {
      console.error('Error handling unauthorized access:', error);
    }
  };

  // Authentication effect
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setIsCheckingAuth(true);
        const isAllowed = await checkUserAuthorization(user.email);
        
        if (!isAllowed) {
          handleUnauthorizedAccess(user.email, 'session_check');
        } else {
          setUser(user);
          setIsAuthorized(true);
          
          // If on login page, redirect to main page
          if (location.pathname === '/login') {
            navigate('/');
          }
        }
        setIsCheckingAuth(false);
      } else {
        setUser(null);
        setIsAuthorized(false);
        setIsCheckingAuth(false);
        
        // If not on login page, redirect to login
        if (location.pathname !== '/login') {
          navigate('/login');
        }
      }
    });
  
    return () => unsubscribe();
  }, [navigate, location.pathname]);

  // Google Sign-in handler
  const handleGoogleSignIn = async () => {
    try {
      setLoginError('');
      const result = await signInWithPopup(auth, googleProvider);
      const isAllowed = await checkUserAuthorization(result.user.email);
      
      if (!isAllowed) {
        handleUnauthorizedAccess(result.user.email, 'google');
      }
    } catch (error) {
      setLoginError(error.message);
    }
  };

  // Email/Password login handler  
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      setLoginError('');
      
      if (!loginEmail || !loginPassword) {
        setLoginError('Please enter both email and password');
        return;
      }
  
      const result = await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      
      const isAllowed = await checkUserAuthorization(result.user.email);
      
      if (!isAllowed) {
        handleUnauthorizedAccess(result.user.email, 'email');
      }
    } catch (error) {
      console.error("Login error:", error.code, error.message);
      
      // More user-friendly error messages
      switch (error.code) {
        case 'auth/invalid-email':
          setLoginError('Invalid email address format');
          break;
        case 'auth/user-not-found':
          setLoginError('No account exists with this email');
          break;
        case 'auth/wrong-password':
          setLoginError('Incorrect password');
          break;
        default:
          setLoginError(error.message);
      }
    }
  };

  // Logout handler
  const handleLogout = () => {
    signOut(auth);
    setIsAuthorized(false);
    navigate('/login');
  };

  // Determine current page for title
  const getPageTitle = () => {
    if (location.pathname === '/') return 'Inventory Finder';
    if (location.pathname === '/add-product') return 'Add Products';
    if (location.pathname === '/locations') return 'Location Management';
    if (location.pathname === '/categories') return 'Category Management';
    return 'Inventory Finder';
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4">Verifying access...</p>
        </div>
      </div>
    );
  }

  // Login form
  if (!user || !isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-96">
          <CardHeader className="text-center">
            <img 
              src="/logo.png" 
              alt="Nigaran Stores" 
              className="mx-auto h-16 w-auto mb-4"
            />
            <CardTitle>Login to Inventory System</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Google Sign In Button */}
            <button
              onClick={handleGoogleSignIn}
              className="w-full p-2 mb-4 bg-white border-2 border-gray-300 rounded flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors"
            >
              <img 
                src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
                alt="Google" 
                className="w-6 h-6"
              />
              Sign in with Google
            </button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Or continue with email</span>
              </div>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <input
                  type="email"
                  placeholder="Email"
                  className="w-full p-2 border rounded"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                />
              </div>
              <div>
                <input
                  type="password"
                  placeholder="Password"
                  className="w-full p-2 border rounded"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                />
              </div>
              {loginError && (
                <Alert variant="destructive">
                  <AlertDescription>{loginError}</AlertDescription>
                </Alert>
              )}
              <button
                type="submit"
                className="w-full p-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Login with Email
              </button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render main inventory interface if authenticated
  return (
    <div className="flex flex-col min-h-screen">
      <header className="p-4 bg-white shadow-sm">
        {/* Logo and Title - Always visible */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <img 
              src="/logo.png" 
              alt="Nigaran Stores" 
              className="h-10 w-auto"
            />
            <h1 className="text-xl sm:text-2xl font-bold truncate">
              Nigaran Stores - {getPageTitle()}
            </h1>
          </div>
          
          {/* User email on the same line for larger screens, below for mobile */}
          <span className="text-sm text-gray-600 hidden sm:block">{user.email}</span>
        </div>
        
        {/* Mobile only: user email below the title */}
        <div className="sm:hidden mb-2">
          <span className="text-sm text-gray-600">{user.email}</span>
        </div>
        
        {/* Navigation buttons - Responsive layout */}
        <div className="flex flex-wrap gap-2">
          <Link
            to="/"
            className={`flex items-center gap-1 px-2 py-1 sm:px-3 sm:py-2 text-sm rounded hover:bg-gray-200 ${
              location.pathname === '/' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
            }`}
          >
            <Search size={18} />
            Inventory
          </Link>
          
          <Link
            to="/add-product"
            className={`flex items-center gap-1 px-2 py-1 sm:px-3 sm:py-2 text-sm rounded hover:bg-gray-200 ${
              location.pathname === '/add-product' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
            }`}
          >
            <PlusCircle size={18} />
            Add Products
          </Link>
          
          <Link
            to="/locations"
            className={`flex items-center gap-1 px-2 py-1 sm:px-3 sm:py-2 text-sm rounded hover:bg-gray-200 ${
              location.pathname === '/locations' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
            }`}
          >
            <Grid3X3 size={18} />
            Manage Locations
          </Link>
          
          <Link
            to="/categories"
            className={`flex items-center gap-1 px-2 py-1 sm:px-3 sm:py-2 text-sm rounded hover:bg-gray-200 ${
              location.pathname === '/categories' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
            }`}
          >
            <Grid3X3 size={18} />
            Manage Categories
          </Link>
          
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 px-2 py-1 sm:px-3 sm:py-2 text-sm bg-gray-100 rounded hover:bg-gray-200 text-gray-700 ml-auto"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </header>
      
      <main className="flex-1 p-4 bg-gray-50">
        <Outlet context={{ user }} />
      </main>
    </div>
  );
};

export default ShopInventoryAuth;