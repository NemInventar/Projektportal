import React from 'react';
import Layout from '@/components/Layout';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const TestPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  return (
    <Layout>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Test Side</h1>
        <p>Parameter ID: {id || 'Ingen ID'}</p>
        <div className="mt-4 space-x-2">
          <Button onClick={() => navigate('/standard/materials')}>
            Tilbage til materialer
          </Button>
          <Button onClick={() => navigate('/standard/materials/test-123')}>
            Test med ID
          </Button>
        </div>
      </div>
    </Layout>
  );
};

export default TestPage;